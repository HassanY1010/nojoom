let accessToken: string | null = null;

export const authSession = {
  getAccessToken: () => accessToken,

  setAccessToken: (token?: string | null) => {
    accessToken = token || null;
  },

  clear: () => {
    accessToken = null;
  },
};
