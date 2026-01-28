export const authService = {
  async signIn(email, password) {
    // TODO: replace with Firebase Auth
    if (!email || !password) throw new Error("Missing credentials");
    return { userId: "demo", role: "cashier", email };
  },
  async signOut() {
    return true;
  },
  async getSession() {
    return null;
  }
};
