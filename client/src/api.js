import { supabase } from './supabaseClient';

async function request(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 204) return null;

  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const message = (body && body.error) || `Error ${res.status}`;
    throw new Error(message);
  }
  return body;
}

export const api = {
  listProjects: () => request('/projects'),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id) => request(`/projects/${id}`),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
};
