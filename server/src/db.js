const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function load() {
  if (!fs.existsSync(dbFile)) {
    return { users: [], projects: [], nextUserId: 1, nextProjectId: 1 };
  }
  try {
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch {
    return { users: [], projects: [], nextUserId: 1, nextProjectId: 1 };
  }
}

let state = load();

function persist() {
  fs.writeFileSync(dbFile, JSON.stringify(state, null, 2));
}

module.exports = {
  // --- users ---
  findUserByEmail(email) {
    return state.users.find((u) => u.email === email) || null;
  },
  findUserById(id) {
    return state.users.find((u) => u.id === Number(id)) || null;
  },
  createUser({ email, passwordHash, name }) {
    const user = { id: state.nextUserId++, email, passwordHash, name, createdAt: new Date().toISOString() };
    state.users.push(user);
    persist();
    return user;
  },

  // --- projects ---
  listProjectsByUser(userId) {
    return state.projects
      .filter((p) => p.userId === Number(userId))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },
  getProject(userId, id) {
    return state.projects.find((p) => p.id === Number(id) && p.userId === Number(userId)) || null;
  },
  createProject(userId, { name, tasks }) {
    const now = new Date().toISOString();
    const project = {
      id: state.nextProjectId++,
      userId: Number(userId),
      name,
      unit: 'Días',
      startDate: '',
      excludeWeekends: false,
      notesHtml: '',
      notesAttachmentName: '',
      tasks,
      createdAt: now,
      updatedAt: now,
    };
    state.projects.push(project);
    persist();
    return project;
  },
  updateProject(userId, id, patch) {
    const project = this.getProject(userId, id);
    if (!project) return null;
    Object.assign(project, patch, { updatedAt: new Date().toISOString() });
    persist();
    return project;
  },
  deleteProject(userId, id) {
    const project = this.getProject(userId, id);
    if (!project) return false;
    state.projects = state.projects.filter((p) => p.id !== project.id);
    persist();
    return true;
  },
};
