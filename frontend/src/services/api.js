import axios from 'axios';

const api = axios.create({
  baseURL: '/api/game',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const gameApi = {
  newGame: async (heroPosition = 'BTN', villainPosition = 'BB') => {
    const response = await api.post('/new', {
      hero_position: heroPosition,
      villain_position: villainPosition
    });
    return response.data;
  },

  getState: async () => {
    const response = await api.get('/state');
    return response.data;
  },

  submitAction: async (action, amount = 0) => {
    const response = await api.post('/action', { action, amount });
    return response.data;
  },

  computerAction: async () => {
    const response = await api.post('/computer-action');
    return response.data;
  },

  resetGame: async (heroPosition, villainPosition) => {
    const response = await api.post('/reset', {
      hero_position: heroPosition,
      villain_position: villainPosition
    });
    return response.data;
  }
};

export default gameApi;
