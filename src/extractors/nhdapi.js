export default {
  extract: async ({ res }) => {
    return res.status(404).json({error: 'Server 2 (NhdApi) is offline.'});
  }
};
