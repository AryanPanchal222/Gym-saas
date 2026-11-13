import { useEffect, useRef, useState } from "react";
import { apiFetch, getGymId } from "../services/api";
import {
  captureFaceDescriptor,
  findFaceMatch,
  loadFaceRecognition,
} from "../services/faceRecognition";

type Props = {
  enrollMember?: { id: number; name: string; hasFaceEnrollment?: boolean };
  onComplete?: () => void;
};
type FaceTemplate = { id: number; name: string; faceDescriptor: number[] };
type FaceBox = { x: number; y: number; width: number; height: number };

export default function FaceCheckIn({ enrollMember, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const popupTimerRef = useRef<number | null>(null);
  const recentCheckInsRef = useRef(new Map<number, number>());
  const onCompleteRef = useRef(onComplete);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [consented, setConsented] = useState(false);
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [recognizedName, setRecognizedName] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [scanCycle, setScanCycle] = useState(0);

  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (popupTimerRef.current !== null) window.clearTimeout(popupTimerRef.current);
  }, []);

  async function startCamera() {
    setError("");
    setMessage("Loading face recognition models...");
    setShowPopup(false);
    setRecognizedName("");
    setFaceBox(null);

    try {
      await loadFaceRecognition();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setMessage(enrollMember
        ? "Center one face in the frame, then capture."
        : "Camera is scanning for an enrolled member...");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the camera.");
      setMessage("");
    }
  }

  function stopCamera() {
    if (popupTimerRef.current !== null) {
      window.clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
    setFaceBox(null);
    setShowPopup(false);
  }

  function resumeScannerAfter(delayMs: number) {
    if (popupTimerRef.current !== null) window.clearTimeout(popupTimerRef.current);
    popupTimerRef.current = window.setTimeout(() => {
      popupTimerRef.current = null;
      setShowPopup(false);
      setRecognizedName("");
      setFaceBox(null);
      setMessage("Camera is scanning for the next member...");
      setScanCycle((cycle) => cycle + 1);
    }, delayMs);
  }

  async function enrollFace() {
    if (!videoRef.current || !enrollMember) return;
    setBusy(true);
    setError("");
    try {
      const { descriptor } = await captureFaceDescriptor(videoRef.current);
      const gymId = getGymId();
      if (!gymId) throw new Error("Gym information is missing");

      const response = await apiFetch(`/api/gyms/${gymId}/members/${enrollMember.id}/face`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save face enrollment.");

      setMessage(`Face enrollment saved for ${enrollMember.name}.`);
      onCompleteRef.current?.();
      stopCamera();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face enrollment failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!cameraOn || enrollMember) return;

    let cancelled = false;
    let inFlight = false;
    let finished = false;
    let keepCameraForNext = false;
    let templates: FaceTemplate[] | null = null;
    const gymId = getGymId();

    async function scanFrame() {
      const video = videoRef.current;
      if (cancelled || finished || inFlight || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      inFlight = true;

      try {
        if (!gymId) throw new Error("Gym information is missing");
        if (!templates) {
          const response = await apiFetch(`/api/gyms/${gymId}/attendance/face-templates`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Could not load enrolled members.");
          templates = (data.members ?? []) as FaceTemplate[];
          if (!templates.length) throw new Error("No faces are enrolled yet. Enroll members from their profiles first.");
        }

        const result = await captureFaceDescriptor(video);
        if (cancelled || finished) return;
        setFaceBox(result.box);
        setVideoSize({ width: video.videoWidth, height: video.videoHeight });

        const match = findFaceMatch(result.descriptor, templates);
        if (!match) {
          setMessage("Face detected. Looking for a match...");
          return;
        }

        const cooldownUntil = recentCheckInsRef.current.get(match.id);
        if (cooldownUntil && cooldownUntil > Date.now()) {
          const minutesLeft = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 60000));
          setMessage(`Already checked in. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`);
          return;
        }
        recentCheckInsRef.current.delete(match.id);

        finished = true;
        setRecognizedName(match.name);
        setMessage(`Recognized ${match.name}. Recording attendance...`);
        setBusy(true);
        try {
          const response = await apiFetch(`/api/gyms/${gymId}/attendance/check-in`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId: match.id, method: "FACE" }),
          });
          const data = await response.json();
          if (response.status === 409) {
            const retryAfterSeconds = Number(data.retryAfterSeconds) || 300;
            recentCheckInsRef.current.set(match.id, Date.now() + retryAfterSeconds * 1000);
            setMessage(data.message || "Already checked in. Please try again in 5 minutes.");
            keepCameraForNext = true;
            resumeScannerAfter(900);
            return;
          }
          if (!response.ok) throw new Error(data.message || "Unable to record attendance.");
          recentCheckInsRef.current.set(match.id, Date.now() + 5 * 60 * 1000);
          setShowPopup(true);
          setMessage("");
          onCompleteRef.current?.();
          keepCameraForNext = true;
          resumeScannerAfter(3000);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to record attendance.");
        } finally {
          setBusy(false);
          if (!keepCameraForNext) stopCamera();
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Face scan failed.";
        if (detail.startsWith("No face detected")) {
          setFaceBox(null);
          setMessage("Camera is scanning for an enrolled member...");
        } else if (detail.startsWith("Only one person")) {
          setFaceBox(null);
          setMessage("Please make sure only one person is in the frame.");
        } else {
          finished = true;
          setError(detail);
          stopCamera();
        }
      } finally {
        inFlight = false;
      }
    }

    const interval = window.setInterval(() => void scanFrame(), 650);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [cameraOn, enrollMember, scanCycle]);

  const mirroredX = faceBox && videoSize.width
    ? videoSize.width - faceBox.x - faceBox.width
    : 0;

  return (
    <div className="face-checkin-card">
      <div className="face-checkin-copy">
        <div>
          <h3>{enrollMember ? "Face enrollment" : "Face recognition check-in"}</h3>
          <p>{enrollMember
            ? enrollMember.hasFaceEnrollment
              ? "Face recognition is enrolled. Capture again to update the member's template."
              : "Capture a clear face to enable camera check-in."
            : "Look at the camera. GymFlow will detect and check in an enrolled member automatically."}</p>
        </div>
        {!cameraOn
          ? <button className="secondary-button" onClick={startCamera}>Open camera</button>
          : <button className="secondary-button" onClick={stopCamera} disabled={busy}>Close camera</button>}
      </div>

      {enrollMember && <label className="face-consent">
        <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
        The member agrees to face recognition for attendance. GymFlow stores a face template, not a camera photo.
      </label>}

      {cameraOn && <>
        <div className="face-camera-frame">
          <video ref={videoRef} autoPlay muted playsInline className="face-camera" />
          {faceBox && videoSize.width > 0 && <svg
            className="face-detection-overlay"
            viewBox={`0 0 ${videoSize.width} ${videoSize.height}`}
            aria-hidden="true"
          >
            <rect x={mirroredX} y={faceBox.y} width={faceBox.width} height={faceBox.height} rx="12" />
          </svg>}
          {!enrollMember && faceBox && <div className="face-detection-tag">Face detected</div>}
        </div>
        {enrollMember
          ? <button className="primary-button" onClick={enrollFace} disabled={busy || !consented}>
              {busy ? "Saving..." : enrollMember.hasFaceEnrollment ? "Capture and update" : "Capture and enroll"}
            </button>
          : <p className={`face-scan-status${message.startsWith("Already checked in") ? " duplicate" : ""}`} aria-live="polite">{busy ? "Recording attendance..." : message}</p>}
      </>}

      {message && (!cameraOn || enrollMember) && <p className="form-message success">{message}</p>}
      {error && <p className="form-message error">{error}</p>}
      {!enrollMember && <small>Face templates are stored per gym. Manual staff check-in remains available.</small>}

      {showPopup && <div className="face-result-backdrop" role="presentation">
        <section className="face-result-popup" role="dialog" aria-modal="true" aria-labelledby="face-result-title">
          <div className="face-result-icon" aria-hidden="true">&#10003;</div>
          <p className="eyebrow">ATTENDANCE RECORDED</p>
          <h3 id="face-result-title">Welcome, {recognizedName}</h3>
          <p>Face recognized and check-in completed.</p>
          <p className="face-popup-next">Camera will scan for the next person in 3 seconds.</p>
        </section>
      </div>}
    </div>
  );
}
