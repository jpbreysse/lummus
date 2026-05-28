# Lummus — User guide

A short walkthrough for participants in the Lummus Phase 2 programme. If you're an admin, see also the rest of the repo docs.

## 1. First-time sign-in

You'll receive a personal **invite link** from an admin, looking like:

```
https://crmenergy.osc-fr1.scalingo.io/signup?invite=abc123…
```

1. Click the link. You land on the sign-up page with the invite already attached.
2. Fill in:
   - **Name** — how you'll appear in the app
   - **Email** — pre-filled if the invite was scoped to your address; otherwise type yours
   - **Password** — at least 8 characters, chosen by you (no email reset yet — pick something memorable)
3. Click **Create account**. You're signed in automatically and land on the dashboard.

If you ever get signed out, return to the same URL (without the invite part) and use **Sign in** with the email and password you just chose.

> The invite link is **single-use**. Don't share it — each person needs their own.

## 2. Finding your way around

The sidebar on the left shows everything you can access:

| Item | What you'll find |
|---|---|
| **Dashboard** | Programme overview · next meeting · latest announcements |
| **Workshops** | The workshops you're a participant of |
| **Questions** | All questions from your accessible workshops, filterable by status |
| **Announcements** | News from the admin |

You'll only see the workshops you've been added to as a participant. If a workshop looks missing, ask the admin to add you.

> Inside a workshop page you only see the **Questions** panel — Participants and Hours are admin-only.

## 3. Answering a question

Some workshops have role-specific questions (PM vs Engineer). You'll only see the questions that apply to you — questions tagged for the other role are filtered out. If you think a question is missing or showing up by mistake, ask the admin to check your workshop role on the **Users** page.

1. Open a workshop from the sidebar or dashboard, e.g. `W1`.
2. Each question is shown as a row. Click **Add your response** (or **Your response** if you've already saved one) to expand it.
3. Pick how you want to answer using the two buttons at the top of the response box:

   - **As me** — your name is attached to the answer. The admin sees who wrote what. You can edit or delete it later.
   - **Anonymous** — the admin sees the answer but **not your name**. You can revisit your own anonymous answers here in the future (they persist across sessions), and you can **delete** your own ones if you change your mind. They **cannot be edited** — to reword, delete and submit a new one.

4. Type your answer, then click **Save** (named) or **Submit anonymously**.

### Switching between modes

You can submit both a named answer AND one or more anonymous answers to the same question — they're stored independently. Switching the radio button just changes which form you're using.

### Editing or deleting a named response

- **Edit** — open the question, switch to **As me**, change the text, click **Update**.
- **Delete** — open the question, switch to **As me**, click **Delete** in the top-right of the response box.

(Anonymous answers can't be edited, but you can delete your own. You can read your own past anonymous answers on the question, while the admin only sees the text, not your name.)

## 4. Commenting on a question

Below your response area, click the **0 comments** / **N comments** button to expand the comment thread.

- Comments **always show your name** — they're not anonymous.
- Standard users see only **their own** comments. The admin sees all comments.
- You can delete your own comments at any time.

To post a comment: type into the textarea at the bottom of the thread and click **Post**.

## 5. Reading announcements

The admin posts announcements (next meeting time, agenda changes, follow-ups). The three most recent ones appear on your dashboard's **News** column on the right. Click **All →** to see the full list at `/announcements`.

## 6. Privacy reminders

- Your **named responses** are visible only to admins and yourself.
- Your **anonymous responses** are visible to admins, but the admin only sees the answer text — not your name. You can review and delete your own anonymous answers on each question.
- Your **comments** are visible to admins, and to yourself. Other participants do not see them.
- Your **email** is visible only to admins (on the `/users` page).

## 7. Getting help

- **Forgot password** — there's no self-service reset yet. Ask the admin to set a new password for you; you'll sign in with that, then can keep using it.
- **Wrong workshop visible / missing** — ask the admin to update your participant assignment.
- **Anything else** — talk to the admin.

---

*Last updated: 20 May 2026.*
