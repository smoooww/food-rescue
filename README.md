# Mustang Pantry

A static Firebase web app for viewing and managing daily pantry stock.

## Run Locally

You need Node.js installed. From the repository folder, start a local web server:

```bash
npx serve .
```

Open the URL printed in the terminal, usually:

```text
http://localhost:3000
```

Do not open `index.html` by double-clicking it. The app uses browser modules and Firebase, so it should run through `http://localhost`.

## Firebase Requirements

The app uses the existing Firebase project configured in `index.html`:

- Project ID: `food-rescue-4c0d7`
- Firebase Authentication: Email/password sign-in enabled
- Firestore database: enabled
- Authorized domains: add the domain where the app is hosted
- Regular users: verified `@calpoly.edu` email addresses
- Pantry staff: `pantry-staff@calpoly.edu`

Only the pantry staff account can add, edit, or remove stock. Regular Cal Poly users can browse available stock.

## Deploy Firestore Rules

Only a Firebase project owner or collaborator with permission should deploy rules. From the repository folder:

```bash
npx firebase-tools login
npx firebase-tools use food-rescue-4c0d7 --alias default
npx firebase-tools deploy --only firestore:rules
```

The rules in `firestore.rules` are hosted by Firebase. Pushing them to GitHub alone does not update the live Firestore rules.

## GitHub Pages

To publish the static website:

1. Open the repository's **Settings** on GitHub.
2. Open **Pages**.
3. Choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`.
5. Save.
6. Add the resulting GitHub Pages domain to Firebase Authentication's **Authorized domains**.

The site URL will usually look like:

```text
https://smoooww.github.io/food-rescue/
```
