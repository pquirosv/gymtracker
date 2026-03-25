# Gymtracker

This is an [Expo](https://expo.dev) that uses supabase as backend, with Authentication and a postgres database. Once logged, the user can create his/her own routines with different exercises.

## Static web deployment

This project is configured to generate a static website for web deployments.

### Build the static site locally

```bash
npm run build:web
```

Expo will export the site to `dist/`.

### GitHub Actions server deployment

This repository now includes a GitHub Actions workflow at `.github/workflows/deploy-web.yml`.

- It runs on pushes to `main`
- It can also be triggered manually from the GitHub Actions tab with `workflow_dispatch`
- It builds the Expo web bundle and uploads `dist/` to your server over SSH with `rsync`

The workflow assumes your server already serves static files from a directory such as `/var/www/gymtracker`.

### Required GitHub secrets

Add these repository or environment secrets before running the workflow:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY`
- `SERVER_HOST`
- `SERVER_PORT`
- `SERVER_USER`
- `SERVER_PATH`
- `SERVER_SSH_PRIVATE_KEY`
- `SERVER_KNOWN_HOSTS`

You can generate `SERVER_KNOWN_HOSTS` locally with:

```bash
ssh-keyscan -H your-server-domain-or-ip
```

### Server notes

- `SERVER_PATH` should point to the directory your web server exposes
- the SSH user must have write access to that directory
- if you deploy behind Nginx or Caddy, no app process restart is needed for static files

After that, every push to `main` can publish the web app to your server through GitHub Actions.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).
