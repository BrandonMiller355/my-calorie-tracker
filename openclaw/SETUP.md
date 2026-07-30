# OpenClaw setup for cal-tracker

One-time steps on the **OpenClaw machine** to give the agent the
`cal-tracker` skill (read consumed calories, write daily burn) and the daily
burn-sync cron job. Protocol details live in
[docs/openclaw-access.md](../docs/openclaw-access.md); the skill and script
are in [cal-tracker/](cal-tracker/).

## 1. Install the skill

Copy the `openclaw/cal-tracker/` folder into the agent's skills directory —
`~/.openclaw/skills/` (or `<workspace>/skills/` if you prefer
workspace-scoped skills, which take precedence):

```bash
cp -r openclaw/cal-tracker ~/.openclaw/skills/cal-tracker
chmod +x ~/.openclaw/skills/cal-tracker/scripts/caltracker.sh
```

Dependencies: `curl` and `jq` must be on the PATH.

## 2. Credentials

Append to `~/.openclaw/.env` (create it if missing). The first two values are
the same public ones the web app ships; only the password is a real secret:

```bash
SUPABASE_URL=https://ntrzoegzvfwijpdhrgqa.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_1sZtUmt6E6X_2OBJNWuviA_8H6VWRmr
CALTRACKER_EMAIL=BrandonMiller355@gmail.com
CALTRACKER_PASSWORD=<the app password>
```

Restart the gateway afterward so it picks the vars up.

> Sandbox note: `~/.openclaw/.env` reaches the host agent's process env. If
> your agent runs skills in a sandbox, env vars don't pass through
> automatically — set them via `skills.entries.cal-tracker.env` in
> `openclaw.json` instead (see OpenClaw's skills-config docs).

## 3. Smoke test

Straight from a shell first (loads the env file just for the test):

```bash
set -a; source ~/.openclaw/.env; set +a
S=~/.openclaw/skills/cal-tracker/scripts/caltracker.sh
"$S" consumed today
"$S" set-burn today 2500
"$S" find
"$S" log '{"meal":"snacks","name":"smoke test food","description":"delete me","calories":100,"carbs":1,"protein":1,"fat":1}'
```

The `set-burn` output's `effective_goal_calories` should read back `2500`,
and the app's log screen for today should show a custom calorie goal of 2500
with the macro goals still at your defaults. `find` prints your saved foods.
`log` prints the inserted entry and it appears under today's snacks in the app
— delete that test entry there, then reset the day by clearing the custom goal
(or setting the burn back).

The `find`/`log` path writes straight to the `food_entries` table through RLS,
so unlike the burn sync it needs **no new database function** — nothing extra
to deploy.

Then through the agent: ask OpenClaw *"how many calories have I eaten
today?"* and it should invoke the skill and answer, and say *"log an egg white
omelet for breakfast"* — it should `find`, then `log` a matched or quick entry
and tell you which.

## 4. Daily burn-sync cron job

```bash
openclaw cron add \
  --cron "30 6 * * *" --tz "America/New_York" \
  --name "cal-tracker burn sync" \
  --session isolated \
  --announce \
  "Run the cal-tracker skill's daily burn sync: find my total calories \
burned yesterday from your activity data, then run \
'scripts/caltracker.sh set-burn yesterday <kcal>' and report the \
confirmation row. If you don't have yesterday's burn, say so and write \
nothing."
```

Adjust the schedule to taste (6:30am gives the previous day's data time to
finalize). Drop `--announce` if you don't want the daily confirmation
message. Edit the "from your activity data" phrasing to name wherever the
burn number actually lives if the agent doesn't find it on its own.

## Semantics reminders

- Dates are local-calendar `YYYY-MM-DD` in **America/New_York**; the script's
  `today`/`yesterday` keywords already handle this.
- `set_day_burn` **always overwrites calories** (a synced actual beats any
  mid-day estimate) and **never touches macro goals**.
- The sync writes yesterday; the weekly deficit widget picks it up
  immediately.
