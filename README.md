# Bond Market Quiz — Setup & Deployment Guide

A daily-login, auto-graded, 18-day quiz platform built from your Bond Market
Concepts content bank. Every Tier 1–3 question has been converted into a
4-option MCQ so it can be scored instantly. Students see a live coupon
schedule and leaderboard; you control the roster and which day is unlocked
from a separate faculty panel.

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` + `student.js` | The student-facing app (login, daily quiz, leaderboard) |
| `admin.html` + `admin.js` | Your faculty panel (rosters, unlock control) |
| `data/questions.js` | All 18 days, 162 MCQs, with explanations |
| `styles.css` | Visual design |
| `firebase-config.js` | **You edit this** — your Firebase project keys |
| `firebase-init.js` | Shared Firebase startup code |
| `firestore.rules` | Security rules to paste into Firebase |

No build step, no npm install — it's plain HTML/CSS/JS, so it can be hosted
on GitHub Pages (or literally any static file host) for free.

---

## Step 1 — Create a free Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with your Google account.
2. Click **Add project**, give it a name (e.g. `bond-market-quiz`), and finish the wizard (you can disable Google Analytics).
3. Once created, click the **`</>`** (web) icon on the project overview page to register a web app. Name it anything.
4. Firebase will show you a `firebaseConfig` object. Copy it.
5. Open `firebase-config.js` in this folder and paste your values in, replacing the placeholders.

## Step 2 — Turn on Firestore and Anonymous sign-in

1. In the left sidebar: **Build → Firestore Database → Create database**. Choose *production mode* and any nearby region.
2. Go to **Build → Authentication → Get started → Sign-in method**, and enable **Anonymous**. (Students never see this — it just lets the app talk to Firestore securely. Your real login screen is the class code / roll no / password form.)
3. Go to **Firestore Database → Rules**, delete the default text, and paste in the contents of `firestore.rules` from this folder. Click **Publish**.

Read the note at the bottom of `firestore.rules` — it explains the security
trade-off of a no-backend, static-site setup. It's fine for classroom
practice quizzes; don't reuse sensitive passwords.

## Step 3 — Put the files online (GitHub Pages)

1. Create a new **public** GitHub repository (e.g. `bond-market-quiz`).
2. Upload every file in this folder to it (drag-and-drop on github.com works, or `git push`), keeping the `data/` subfolder.
3. In the repo, go to **Settings → Pages**. Under "Build and deployment," choose **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. GitHub will give you a URL like `https://yourusername.github.io/bond-market-quiz/` within a minute or two. That's the web address students will use.
5. Your faculty panel is at the same address plus `/admin.html`, e.g. `https://yourusername.github.io/bond-market-quiz/admin.html`. **Don't share this link with students.**

If you'd rather not use GitHub, you can also drag this whole folder into
[Firebase Hosting](https://firebase.google.com/docs/hosting) (`firebase deploy`), Netlify, or Vercel — any static host works identically.

## Step 4 — Set up your class

1. Open your `/admin.html` link. The first time, it asks you to **create a faculty passcode** — pick one and save it; you'll need it every time you return.
2. Click **Create a new class**. Choose a short **class code** (this is what students type to sign in, e.g. `MBA25A`) and a display name.
3. Paste your roster into the **Add students** box, one student per line:
   ```
   F2025013, Priya Menon, coupon25
   F2025014, Arjun Rao, coupon25
   ```
   (Roll number, name, password — comma-separated. You choose the passwords; keep them simple since this isn't sensitive data.)
4. Day 1 is unlocked by default. Each day (or whenever you're ready), come back and click **Unlock next day** to open the next day's quiz for the whole class. Unlocking is manual by design, so you stay in control of pacing — it doesn't auto-unlock at midnight.

## Step 5 — Share with students

Send students:
- The site URL (`index.html` link)
- Their class code
- Their roll number + password (from what you set in Step 4)

They log in, see a grid of 18 "coupon" cards (locked/open/redeemed), and can
open whichever day is currently unlocked. Each quiz shows the day's 2 news
articles, then steps through 9 MCQs one at a time with instant feedback and a
short explanation after each answer. Their score is saved automatically, and
the **Leaderboard** tab shows the whole class ranked by total points.

---

## How grading works

All 162 questions (Tiers 1–3, including the original numeric/analytical
ones) were converted into 4-option multiple choice, using the original
answer key as the correct option and three plausible distractors. Scoring is
instant and automatic — 1 point per question, 9 points per day, 162 total
across the unit.

## Customizing later

- **Wording/options**: edit `data/questions.js` directly — it's a plain JS array, one object per day.
- **Look and feel**: all colors, fonts, and spacing are CSS variables at the top of `styles.css`.
- **Auto-unlock by date instead of manual**: in `student.js`, the dashboard reads `CLASS_DOC.unlockedDay` from Firestore — you could replace the admin's manual button with a scheduled Cloud Function if you later move to Firebase's Blaze plan.
- **Multiple sections**: just create another class in the admin panel with its own class code; the same site serves all of them.

## Troubleshooting

- **"Could not reach the server"** on login — double check `firebase-config.js` values and that Firestore + Anonymous auth are both enabled.
- **Students can't sign in** — confirm the class code matches exactly (it's uppercased automatically) and the roll number line was added correctly in the admin roster box.
- **Leaderboard empty** — it only lists students who've been added via the admin roster box, regardless of whether they've completed a quiz yet.
