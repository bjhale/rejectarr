# rejectarr

CLI for managing qBittorrent and Sonarr. It finds downloads that break your rules, such as executables or archives posing as TV episodes, and removes them through Sonarr so Sonarr blocklists the release and searches again. Uses [pnpm](https://pnpm.io) for packages and [Bun](https://bun.com) as the runtime.

## Setup

Install dependencies:

```bash
pnpm install
```

Configure `QBITTORRENT_HOST`, `QBITTORRENT_USERNAME`, `QBITTORRENT_PASSWORD`, `SONARR_HOST` and `SONARR_API_KEY` in `.env`.

## Commands

```bash
pnpm cli help                 # list commands
pnpm cli qbt:list             # torrents in qBittorrent
pnpm cli qbt:info <hash>      # details for one torrent
pnpm cli sonarr:list          # downloads in the Sonarr queue
pnpm cli sonarr:info <hash>   # details for one Sonarr download
pnpm cli rules:execute [file] # find torrents that violate the rules (default: ruleset.yml)
pnpm cli rules:remove [file]  # remove violating downloads via Sonarr (asks first)
```

`<hash>` is the torrent hash or any unique prefix of it, such as the 8 characters the list commands show. The same hash identifies a download in both qBittorrent and Sonarr.

`rules:remove` matches each violating torrent to its Sonarr queue item and removes it as the Sonarr UI's "Remove from Download Client" with "Blocklist and Search" would: the torrent and its data are deleted from qBittorrent, the release is blocklisted, and Sonarr searches for a replacement. Torrents not in the Sonarr queue are skipped. It shows what it will remove and asks for confirmation; `--dry-run` only shows, and `--yes` skips the prompt.

## Rules

Rules live in `ruleset.yml`. A file has two lists:

- **`rulesets`** say what to match and what to do with it. Each has an `id`, an `action` (`accept` or `reject`), and at least one of:
  - `filePatterns`: globs matched against each file in the torrent. They match the file name, ignoring case, unless the pattern contains `/`, in which case it matches the full path inside the torrent.
  - `sonarrMessageRegex`: regular expressions tested against the status and error messages Sonarr shows for the download in its queue. A message describes the whole download, so a match applies to every file in the torrent. Torrents that aren't in the Sonarr queue have no messages.

  A ruleset with both matches only files that satisfy both.
- **`rules`** connect rulesets to torrents. Each has an `id`, the qBittorrent `category` it applies to (exact match, case-sensitive), and the `rulesets` to apply, by ID.

For each file, the rule's rulesets are checked in order and **the last one that matches decides**. So a reject listed above an accept loses to the accept. Files that nothing matches are accepted. A torrent violates the rules if any of its files ends up rejected. Torrents in categories no rule mentions are never checked.

Run `pnpm cli rules:execute` after editing to see what your rules catch before using `rules:remove`.

### Example: reject executables

The simplest setup: any torrent in `tv-shows` containing a Windows executable or script is rejected.

```yaml
rules:
  - id: tv-shows
    category: tv-shows
    rulesets:
      - exe

rulesets:
  - id: exe
    action: reject
    filePatterns:
      - "*.exe"
      - "*.msi"
      - "*.bat"
      - "*.cmd"
      - "*.ps1"
      - "*.scr"
```

`Show.S01E01.1080p/Show.S01E01.1080p.EXE` is rejected (case and folders don't matter). A torrent containing only `Show.S01E01.1080p.mkv` passes.

### Example: reject archives, but allow subtitle archives

Order matters. `archives` rejects every archive, then `subtitle-archives` accepts the ones inside a `Subs` folder. Because it comes later, it wins for those files.

```yaml
rules:
  - id: tv-shows
    category: tv-shows
    rulesets:
      - archives
      - subtitle-archives

rulesets:
  - id: archives
    action: reject
    filePatterns:
      - "*.zip"
      - "*.rar"
      - "*.7z"
  - id: subtitle-archives
    action: accept
    filePatterns:
      - "**/Subs/*.zip"
```

| File | Result |
| --- | --- |
| `Show.S01E01/Show.S01E01.mkv` | accepted (nothing matched) |
| `Show.S01E01/Subs/English.zip` | accepted (`subtitle-archives` matched last) |
| `Show.S01E01/Show.S01E01.7z` | rejected (`archives`) |

If the two rulesets were listed the other way round, `archives` would come last and reject the subtitle zip too.

### Example: reject downloads Sonarr can't import

Some fakes use a normal-looking file name but still can't be imported. Sonarr's queue message catches these when the file name doesn't.

```yaml
rules:
  - id: tv-shows
    category: tv-shows
    rulesets:
      - cant-import

rulesets:
  - id: cant-import
    action: reject
    sonarrMessageRegex:
      - "No files found are eligible for import"
```

The regex only needs to match part of the message, so `.*` at either end is unnecessary. Matching is case-sensitive; write `[Nn]o files` to allow either case. To see the exact messages Sonarr reports for a download, run `pnpm cli sonarr:info <hash>`.

### Example: combining conditions

A ruleset with both `filePatterns` and `sonarrMessageRegex` matches a file only when both match. This rejects `.mkv` files only in downloads whose Sonarr messages mention a sample, leaving other files in the torrent alone:

```yaml
rulesets:
  - id: sample-video
    action: reject
    filePatterns:
      - "*.mkv"
    sonarrMessageRegex:
      - "[Ss]ample"
```

### Example: several categories

Rulesets are shared, so one definition can serve several categories, each with its own order. Several rules can also target the same category; their rulesets run in the order the rules appear in the file.

```yaml
rules:
  - id: tv-shows
    category: tv-shows
    rulesets:
      - exe
      - archives
      - cant-import
  - id: anime
    category: anime
    rulesets:
      - exe
      - cant-import

rulesets:
  - id: exe
    action: reject
    filePatterns: ["*.exe", "*.msi", "*.bat", "*.cmd", "*.ps1", "*.scr"]
  - id: archives
    action: reject
    filePatterns: ["*.zip", "*.rar", "*.7z", "*.tar", "*.gz"]
  - id: cant-import
    action: reject
    sonarrMessageRegex:
      - "No files found are eligible for import"
```

Here `anime` torrents may contain archives, but `tv-shows` torrents may not.

## Development

```bash
pnpm typecheck
pnpm test
```
