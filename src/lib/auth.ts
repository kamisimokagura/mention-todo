export type BasicCredentials = {
  username: string;
  password: string;
};

export function getBasicCredentials(): BasicCredentials | null {
  const username = process.env.BASIC_AUTH_USER?.trim();
  const password = process.env.BASIC_AUTH_PASSWORD?.trim();
  if (!username || !password) return null;
  return { username, password };
}

