# Secure Cloud Vault

This is a beginner-friendly secure cloud storage project with:

- Signup and login
- User-only dashboard
- Secure file upload
- Client-side encryption before upload

## What is different in this project?

Most beginner cloud storage projects upload normal files directly to the server. That means the server owner or admin can read them.

This project is different because:

- the file is encrypted in the browser before upload
- the server stores only encrypted data
- the admin cannot read the original file data without the user's vault key
- the user decrypts the file again in the browser during download

This is the main project idea you can explain in college, viva, or portfolio:

**"My project uses zero-knowledge style secure cloud storage where even the admin stores only encrypted files."**

## Project structure

- `server.js` = backend server
- `public/index.html` = UI
- `public/style.css` = design
- `public/app.js` = frontend logic for auth, encryption, upload, and download
- `cloud.db` = SQLite database created after first run
- `uploads/` = encrypted uploaded files

## Technologies used

- Node.js
- Express.js
- SQLite
- express-session
- bcryptjs
- multer
- Web Crypto API

## How signup and login work

1. User opens the app.
2. User creates an account with name, email, and password.
3. Password is hashed with `bcryptjs` before storing in the database.
4. User logs in.
5. A session is created.
6. Only logged-in users can upload and see their own files.

## How secure upload works

1. User logs in.
2. User enters a **Vault Key** in the dashboard.
3. User selects a file.
4. In the browser, the file is encrypted using AES-GCM.
5. Only the encrypted file is uploaded to the server.
6. The server saves the encrypted file and metadata.
7. During download, the encrypted file comes back to the browser.
8. The browser decrypts it using the same Vault Key.

## Important security note

If the user forgets the Vault Key, the file cannot be decrypted.

That is because the server does not know the original key.

## How to run this project

### 1. Install Node.js

Download and install Node.js from:

[https://nodejs.org/](https://nodejs.org/)

After installation, check:

```powershell
node -v
npm -v
```

### 2. Open the project folder

```powershell
cd C:\Users\adars\OneDrive\Desktop\cloud
```

### 3. Install dependencies

```powershell
npm install
```

### 4. Start the server

```powershell
npm start
```

### 5. Open in browser

Open:

[http://localhost:3000](http://localhost:3000)

## What you have to do after this

As a beginner, follow this order:

1. Install Node.js
2. Run `npm install`
3. Run `npm start`
4. Open the website
5. Create a new account
6. Login
7. Enter a vault key
8. Upload a file
9. Refresh and try download

## How user data is uploaded in this project

The uploaded flow is:

1. User chooses a file from their device.
2. User enters a secret vault key.
3. `public/app.js` encrypts the file in the browser.
4. Encrypted data is sent using `FormData` to `/api/files/upload`.
5. `server.js` stores that encrypted file inside the `uploads/` folder.
6. File information is saved in SQLite database.

So the server stores the file, but the readable content stays protected.

## What you can improve later

- Add file delete option
- Add file sharing with encrypted links
- Add forgot password flow
- Add OTP email verification
- Store sessions in database for production
- Use HTTPS
- Move the session secret into `.env`
- Deploy on Render, Railway, or VPS

## Beginner explanation in one line

This project is a cloud storage website where users register, log in, encrypt files in the browser, and upload them securely so that even the admin cannot read the real file content.
