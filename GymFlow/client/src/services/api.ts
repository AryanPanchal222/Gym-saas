const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `http://${window.location.hostname}:5000`;

export function getGymId(): number | null {
  const storedGym = localStorage.getItem("gymflow_gym");

  if (!storedGym) {
    return null;
  }

  try {
    const gym = JSON.parse(storedGym);
    const gymId = Number(gym.id);

    return Number.isInteger(gymId) && gymId > 0 ? gymId : null;
  } catch {
    return null;
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = localStorage.getItem("gymflow_token");

  const headers = new Headers(options.headers);

  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
}