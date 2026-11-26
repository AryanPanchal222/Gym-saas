type FaceResult = {
  descriptor: Float32Array;
  detection: { box: { x: number; y: number; width: number; height: number } };
};
type FaceApi = {
  nets: {
    tinyFaceDetector: { loadFromUri: (url: string) => Promise<void> };
    faceLandmark68Net: { loadFromUri: (url: string) => Promise<void> };
    faceRecognitionNet: { loadFromUri: (url: string) => Promise<void> };
  };
  TinyFaceDetectorOptions: new (options?: { inputSize?: number; scoreThreshold?: number }) => unknown;
  detectAllFaces: (input: HTMLVideoElement, options: unknown) => {
    withFaceLandmarks: () => { withFaceDescriptors: () => Promise<FaceResult[]> };
  };
};

declare global {
  interface Window { faceapi?: FaceApi }
}

const libraryUrl = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
const modelUrl = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
let loading: Promise<FaceApi> | null = null;

export function loadFaceRecognition(): Promise<FaceApi> {
  if (window.faceapi) return Promise.resolve(window.faceapi);
  if (loading) return loading;

  loading = new Promise<FaceApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = libraryUrl;
    script.async = true;
    script.onload = () => window.faceapi ? resolve(window.faceapi) : reject(new Error("Face recognition library did not load"));
    script.onerror = () => reject(new Error("Could not load face recognition. Check your internet connection and try again."));
    document.head.appendChild(script);
  }).then(async (api) => {
    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri(modelUrl),
      api.nets.faceLandmark68Net.loadFromUri(modelUrl),
      api.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ]);
    return api;
  }).catch((error) => {
    loading = null;
    throw error;
  });

  return loading;
}

export async function captureFaceDescriptor(video: HTMLVideoElement): Promise<{ descriptor: number[]; box: FaceResult["detection"]["box"] }> {
  const api = await loadFaceRecognition();
  const results = await api.detectAllFaces(video, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (results.length !== 1) throw new Error(results.length === 0 ? "No face detected. Face the camera and try again." : "Only one person should be in the camera frame.");
  return { descriptor: Array.from(results[0].descriptor), box: results[0].detection.box };
}

export function findFaceMatch(input: number[], members: { id: number; name: string; faceDescriptor: number[] }[]) {
  let closest: { id: number; name: string; distance: number } | null = null;
  for (const member of members) {
    if (!Array.isArray(member.faceDescriptor) || member.faceDescriptor.length !== input.length) continue;
    const distance = Math.sqrt(input.reduce((sum, value, index) => sum + (value - member.faceDescriptor[index]) ** 2, 0));
    if (!closest || distance < closest.distance) closest = { id: member.id, name: member.name, distance };
  }
  return closest && closest.distance < 0.48 ? closest : null;
}
