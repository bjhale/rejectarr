function required(name: string): string {
  const value = Bun.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function qbittorrentConfig() {
  return {
    host: required("QBITTORRENT_HOST").replace(/\/+$/, ""),
    username: Bun.env.QBITTORRENT_USERNAME ?? "",
    password: Bun.env.QBITTORRENT_PASSWORD ?? "",
  };
}

export function sonarrConfig() {
  return {
    host: required("SONARR_HOST").replace(/\/+$/, ""),
    apiKey: required("SONARR_API_KEY"),
  };
}
