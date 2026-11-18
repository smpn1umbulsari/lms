// Central Reactive Micro-Store
// Replaces window.materiData, window.tugasData, window.asesmenData, window.questionsList

const state = {
  materi: [],
  tugas: [],
  asesmen: [],
  questions: []
};

const listeners = new Set();

export const store = {
  get(key) {
    return state[key];
  },
  set(key, value) {
    state[key] = value;
    listeners.forEach((fn) => {
      try {
        fn(key, value);
      } catch (err) {
        console.error("Store listener error:", err);
      }
    });
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};
