import { auth } from "./firebase.js";

const BASE = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Appelle l'API Spring Boot avec le jeton Firebase de l'utilisateur connecté. */
async function request(method, path, body) {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, "Non connecté");
  const token = await user.getIdToken();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Serveur injoignable : le back (Spring Boot) est-il lancé ?");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || "Erreur " + res.status);
  return data;
}

export const api = {
  me: () => request("GET", "/api/me"),
  saveProfile: (name, poste) => request("PUT", "/api/me", { name, poste }),
  submit: (entry) => request("POST", "/api/responses", entry),
  myResponses: (limit = 5) => request("GET", "/api/responses/me?limit=" + limit),
  teamResponses: (from, to) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return request("GET", "/api/responses" + (q.size ? "?" + q : ""));
  },
  users: () => request("GET", "/api/users"),
  changeRole: (uid, role) => request("PATCH", `/api/users/${encodeURIComponent(uid)}/role`, { role }),
};
