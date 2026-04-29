const authPanel = document.getElementById("authPanel");
const dashboard = document.getElementById("dashboard");
const landingView = document.getElementById("landingView");
const authPageView = document.getElementById("authPageView");
const authInfoPanel = document.getElementById("authInfoPanel");
const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const uploadForm = document.getElementById("uploadForm");
const createFolderForm = document.getElementById("createFolderForm");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const welcomeText = document.getElementById("welcomeText");
const filesList = document.getElementById("filesList");
const statusBox = document.getElementById("statusBox");
const totalFiles = document.getElementById("totalFiles");
const previewModal = document.getElementById("previewModal");
const previewTitle = document.getElementById("previewTitle");
const previewContent = document.getElementById("previewContent");
const closePreviewBtn = document.getElementById("closePreviewBtn");
const uploadVaultKeyInput = document.getElementById("uploadVaultKey");
const existingFolderSelect = document.getElementById("existingFolderSelect");
const infoSlides = Array.from(document.querySelectorAll(".info-slide"));
const slideDots = Array.from(document.querySelectorAll(".slide-dot"));
const prevSlideBtn = document.getElementById("prevSlideBtn");
const nextSlideBtn = document.getElementById("nextSlideBtn");
const backToHome = document.getElementById("backToHome");
const brandHomeLinks = document.querySelectorAll(".brand-home");
const entryLinks = document.querySelectorAll(".entry-link");
let currentPreviewUrl = null;
let currentSlideIndex = 0;
let slideIntervalId = null;
let currentFolderId = null;
let currentFolderName = null;
let currentFolderVaultKey = "";
let currentFolderFiles = [];
let currentFolders = [];

const tabs = document.querySelectorAll(".tab");
const authForms = document.querySelectorAll(".auth-form");
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
function renderSlide(index) {
  currentSlideIndex = (index + infoSlides.length) % infoSlides.length;
  infoSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === currentSlideIndex);
  });
  slideDots.forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === currentSlideIndex);
  });
}

function restartSlideInterval() {
  clearInterval(slideIntervalId);
  slideIntervalId = setInterval(() => {
    renderSlide(currentSlideIndex + 1);
  }, 4500);
}

function enableEnterToMoveNext(formElement) {
  const fields = Array.from(formElement.querySelectorAll("input"));

  fields.forEach((field, index) => {
    field.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      const nextField = fields[index + 1];
      if (nextField) {
        event.preventDefault();
        nextField.focus();
      }
    });
  });
}

enableEnterToMoveNext(signupForm);
enableEnterToMoveNext(loginForm);

function setAuthRoute(routeName) {
  const targetRoute = routeName === "login" ? "login" : "signup";
  tabs.forEach((item) => item.classList.toggle("active", item.dataset.tab === targetRoute));
  authForms.forEach((form) => form.classList.remove("active"));
  document.getElementById(`${targetRoute}Form`).classList.add("active");
}

function openAuthPage(routeName) {
  const targetRoute = routeName === "login" ? "login" : "signup";
  authPanel.classList.remove("hidden");
  dashboard.classList.add("hidden");
  authPanel.classList.add("auth-route-active");
  landingView.classList.add("hidden");
  if (authInfoPanel) {
    authInfoPanel.classList.add("hidden");
  }
  authPageView.classList.remove("hidden");
  setAuthRoute(targetRoute);

  if (window.location.hash !== `#${targetRoute}`) {
    window.location.hash = targetRoute;
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", (event) => {
    event.preventDefault();
    openAuthPage(tab.dataset.tab);
  });
});

entryLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    openAuthPage(link.getAttribute("href")?.replace("#", "") || "signup");
  });
});

function showHomeLanding() {
  dashboard.classList.add("hidden");
  authPanel.classList.remove("hidden");
  authPanel.classList.remove("auth-route-active");
  authPageView.classList.add("hidden");
  if (authInfoPanel) {
    authInfoPanel.classList.remove("hidden");
  }
  landingView.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "auto" });
}

function syncAuthRouteFromLocation() {
  const route = window.location.hash.replace("#", "");
  if (route === "login" || route === "signup") {
    authPanel.classList.add("auth-route-active");
    landingView.classList.add("hidden");
    dashboard.classList.add("hidden");
    authPanel.classList.remove("hidden");
    if (authInfoPanel) {
      authInfoPanel.classList.add("hidden");
    }
    authPageView.classList.remove("hidden");
    setAuthRoute(route);
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  showHomeLanding();
}

function showStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.background = isError ? "#7f1d1d" : "#102a2a";
  statusBox.classList.add("show");

  clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = setTimeout(() => {
    statusBox.classList.remove("show");
  }, 2800);
}

function clearPreview() {
  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = null;
  }
  previewContent.innerHTML = "";
}

function closePreview() {
  clearPreview();
  previewModal.classList.add("hidden");
}

function showUnsupportedPreviewMessage(fileName) {
  previewContent.innerHTML = `
    <div class="preview-empty">
      <div>
        <strong>${fileName}</strong>
        <p>This file type is not previewable inside the app yet. You can still download it.</p>
      </div>
    </div>
  `;
}

async function renderPreview(fileName, mimeType, fileBlob) {
  previewTitle.textContent = fileName;
  previewModal.classList.remove("hidden");
  clearPreview();

  const blobUrl = URL.createObjectURL(fileBlob);
  currentPreviewUrl = blobUrl;

  if (mimeType.startsWith("image/")) {
    previewContent.innerHTML = `<img class="preview-image" src="${blobUrl}" alt="${fileName}" />`;
    return;
  }

  if (mimeType === "application/pdf") {
    previewContent.innerHTML = `<iframe class="preview-frame" src="${blobUrl}" title="${fileName}"></iframe>`;
    return;
  }

  if (mimeType.startsWith("text/") || mimeType.includes("json")) {
    const textContent = await fileBlob.text();
    const textElement = document.createElement("pre");
    textElement.className = "preview-text";
    textElement.textContent = textContent;
    previewContent.appendChild(textElement);
    URL.revokeObjectURL(blobUrl);
    currentPreviewUrl = null;
    return;
  }

  if (mimeType.startsWith("video/")) {
    previewContent.innerHTML = `<video class="preview-video" src="${blobUrl}" controls></video>`;
    return;
  }

  if (mimeType.startsWith("audio/")) {
    previewContent.innerHTML = `<audio class="preview-audio" src="${blobUrl}" controls></audio>`;
    return;
  }

  URL.revokeObjectURL(blobUrl);
  currentPreviewUrl = null;
  showUnsupportedPreviewMessage(fileName);
}

async function fetchAndDecryptFile(fileId, vaultKey) {
  const response = await fetch(`/api/files/${fileId}/download`);
  if (!response.ok) {
    throw new Error("Could not download file.");
  }

  const blob = await response.blob();
  const originalName = decodeURIComponent(response.headers.get("X-Original-Name"));
  const mimeType = response.headers.get("X-Original-Mime");
  const salt = response.headers.get("X-File-Salt");
  const iv = response.headers.get("X-File-Iv");
  const decrypted = await decryptBlob(blob, vaultKey, salt, iv);
  const fileBlob = new Blob([decrypted], { type: mimeType });

  return {
    originalName,
    mimeType,
    fileBlob
  };
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

async function readResponseData(response) {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  if (isJson) {
    return response.json();
  }

  const text = await response.text();
  return { error: text || "Request failed" };
}

function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToUint8Array(base64) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function deriveKey(vaultKey, salt) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(vaultKey),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 250000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptFile(file, vaultKey) {
  const plainBytes = await file.arrayBuffer();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(vaultKey, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plainBytes);

  return {
    encryptedBlob: new Blob([encrypted], { type: "application/octet-stream" }),
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv)
  };
}

async function decryptBlob(blob, vaultKey, saltBase64, ivBase64) {
  const encryptedBytes = await blob.arrayBuffer();
  const salt = base64ToUint8Array(saltBase64);
  const iv = base64ToUint8Array(ivBase64);
  const key = await deriveKey(vaultKey, salt);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedBytes);

  return decrypted;
}

function setUserView(user) {
  if (user) {
    authPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    welcomeText.textContent = `Welcome back, ${user.name}`;
    loadFolders();
    return;
  }

  authPanel.classList.remove("hidden");
  dashboard.classList.add("hidden");
  filesList.innerHTML = "";
  totalFiles.textContent = "0";
  syncAuthRouteFromLocation();
}

async function loadCurrentUser() {
  try {
    const data = await request("/api/auth/me", { method: "GET" });
    setUserView(data.user);
  } catch (_error) {
    setUserView(null);
  }
}

function renderFolderSelect(folders) {
  existingFolderSelect.innerHTML = `
    <option value="">Select your folder</option>
    ${folders
      .map((folder) => `<option value="${folder.id}">${folder.name}</option>`)
      .join("")}
  `;
}

async function loadFolders() {
  try {
    const data = await request("/api/folders", { method: "GET" });
    currentFolders = data.folders;
    renderFolderSelect(currentFolders);

    if (currentFolderId && !currentFolders.some((folder) => folder.id === currentFolderId)) {
      currentFolderId = null;
      currentFolderName = null;
      currentFolderVaultKey = "";
      currentFolderFiles = [];
    }

    renderFiles();
  } catch (error) {
    showStatus(error.message, true);
  }
}

function renderFiles() {
  totalFiles.textContent = String(
    currentFolders.reduce((count, folder) => count + Number(folder.file_count || 0), 0)
  );

  if (!currentFolders.length) {
    filesList.innerHTML = '<p class="muted">No folders created yet.</p>';
    return;
  }

  if (!currentFolderId) {
    filesList.innerHTML = currentFolders
      .map(
        (folder) => `
          <section class="folder-card folder-summary-card">
            <div class="folder-head">
              <div>
                <p class="section-kicker">Secure Folder</p>
                <h4>${folder.name}</h4>
                <p class="file-meta">${folder.file_count} file(s) stored in this folder</p>
              </div>
              <button data-open-folder="${folder.id}" data-folder-name="${folder.name}" class="ghost-btn folder-open-btn">
                Enter Folder
              </button>
            </div>
          </section>
        `
      )
      .join("");

    document.querySelectorAll("[data-open-folder]").forEach((button) => {
      button.addEventListener("click", () => {
        currentFolderId = Number(button.dataset.openFolder);
        currentFolderName = button.dataset.folderName;
        currentFolderVaultKey = "";
        currentFolderFiles = [];
        renderFiles();
      });
    });
    return;
  }

  filesList.innerHTML = `
    <section class="folder-card">
      <div class="folder-head">
        <div>
          <p class="section-kicker">Opened Folder</p>
          <h4>${currentFolderName}</h4>
          <p class="file-meta">Enter the folder vault key first to access files in this folder.</p>
        </div>
        <button type="button" id="backToFoldersBtn" class="ghost-btn">Back to Folders</button>
      </div>
      ${
        !currentFolderVaultKey
          ? `
            <div class="folder-gate">
              <label class="access-label folder-access-label">
                <span class="access-title">Folder Vault Key</span>
                <span class="access-help">Enter the same vault key used while uploading files in this folder.</span>
                <input
                  type="password"
                  id="folderVaultEntry"
                  placeholder="Enter folder vault key"
                />
              </label>
              <div class="folder-gate-actions">
                <button type="button" id="unlockFolderBtn" class="ghost-btn">Access Folder</button>
              </div>
            </div>
          `
          : `
            <div class="folder-access-bar">
              <p class="file-meta">Folder unlocked. You can now view, download, or delete files.</p>
              <button type="button" id="changeFolderKeyBtn" class="ghost-btn">Change Vault Key</button>
            </div>
            <div class="folder-files">
              ${currentFolderFiles
                .map(
                  (file) => `
                    <article class="file-card">
                      <div class="file-card-main">
                        <strong>${file.original_name}</strong>
                        <p class="file-meta">
                          Uploaded: ${new Date(file.created_at).toLocaleString()}<br />
                          Original size: ${Math.round(file.file_size / 1024)} KB
                        </p>
                      </div>
                      <div class="file-actions-block">
                        <div class="file-actions">
                          <button data-view-id="${file.id}" class="ghost-btn">View</button>
                          <button data-download-id="${file.id}" class="ghost-btn">Download</button>
                          <button data-delete-id="${file.id}" class="ghost-btn danger-btn">Delete</button>
                        </div>
                      </div>
                    </article>
                  `
                )
                .join("")}
            </div>
          `
      }
    </section>
  `;

  document.getElementById("backToFoldersBtn")?.addEventListener("click", () => {
    request(`/api/folders/${currentFolderId}/lock`, { method: "POST" }).catch(() => {});
    currentFolderId = null;
    currentFolderName = null;
    currentFolderVaultKey = "";
    currentFolderFiles = [];
    renderFiles();
  });

  document.getElementById("unlockFolderBtn")?.addEventListener("click", async () => {
    const enteredKey = document.getElementById("folderVaultEntry")?.value.trim() || "";
    if (!enteredKey) {
      showStatus("Enter the folder vault key first.", true);
      return;
    }

    try {
      const data = await request(`/api/folders/${currentFolderId}/unlock`, {
        method: "POST",
        body: JSON.stringify({ vaultKey: enteredKey })
      });
      currentFolderVaultKey = enteredKey;
      currentFolderFiles = data.files;
      currentFolderName = data.folder.name;
      showStatus("Folder unlocked successfully.");
      renderFiles();
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  document.getElementById("changeFolderKeyBtn")?.addEventListener("click", () => {
    request(`/api/folders/${currentFolderId}/lock`, { method: "POST" }).catch(() => {});
    currentFolderVaultKey = "";
    currentFolderFiles = [];
    renderFiles();
  });

  document.querySelectorAll("[data-view-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const vaultKey = currentFolderVaultKey.trim();
      if (!vaultKey) {
        showStatus("Enter the folder vault key before viewing a file.", true);
        return;
      }

      try {
        const fileData = await fetchAndDecryptFile(button.dataset.viewId, vaultKey);
        await renderPreview(fileData.originalName, fileData.mimeType, fileData.fileBlob);
      } catch (error) {
        showStatus("Could not preview file. Check your vault key.", true);
      }
    });
  });

  document.querySelectorAll("[data-download-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const vaultKey = currentFolderVaultKey.trim();
      if (!vaultKey) {
        showStatus("Enter the folder vault key before downloading a file.", true);
        return;
      }

      try {
        const fileData = await fetchAndDecryptFile(button.dataset.downloadId, vaultKey);

        const url = URL.createObjectURL(fileData.fileBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileData.originalName;
        link.click();
        URL.revokeObjectURL(url);
        showStatus("File decrypted and downloaded.");
      } catch (error) {
        showStatus("Decryption failed. Check your vault key.", true);
      }
    });
  });

  document.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const vaultKey = currentFolderVaultKey.trim();
      if (!vaultKey) {
        showStatus("Enter the folder vault key before deleting a file.", true);
        return;
      }

      const shouldDelete = window.confirm("Do you want to delete this file from your cloud?");
      if (!shouldDelete) {
        return;
      }

      try {
        await fetchAndDecryptFile(button.dataset.deleteId, vaultKey);

        const response = await fetch(`/api/files/${button.dataset.deleteId}`, {
          method: "DELETE"
        });
        const data = await readResponseData(response);
        if (!response.ok) {
          throw new Error(data.error || "Delete failed");
        }

        showStatus("File deleted successfully.");
        loadFolders();
      } catch (error) {
        showStatus(error.message, true);
      }
    });
  });
}

createFolderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("newFolderName").value.trim();
  const vaultKey = document.getElementById("newFolderVaultKey").value.trim();

  if (!name || !vaultKey) {
    showStatus("Enter folder name and folder vault key.", true);
    return;
  }

  try {
    const data = await request("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name, vaultKey })
    });
    createFolderForm.reset();
    showStatus("Secure folder created successfully.");
    await loadFolders();
    existingFolderSelect.value = String(data.folder.id);
  } catch (error) {
    showStatus(error.message, true);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const name = String(formData.get("name") || "");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  if (!strongPasswordRegex.test(password)) {
    showStatus(
      "Password must have 8 characters, uppercase, lowercase, number, and special character.",
      true
    );
    return;
  }

  try {
    const data = await request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password
      })
    });

    signupForm.reset();
    window.location.hash = "login";
    syncAuthRouteFromLocation();
    loginForm.elements.email.value = email;
    loginForm.elements.password.focus();
    showStatus(data.message || "Account created successfully. Please login.");
  } catch (error) {
    showStatus(error.message, true);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    loginForm.reset();
    setUserView(data.user);
    showStatus("Logged in successfully.");
  } catch (error) {
    showStatus(error.message, true);
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fileInput = document.getElementById("fileInput");
  const folderId = existingFolderSelect.value;
  const vaultKey = uploadVaultKeyInput.value.trim();
  const file = fileInput.files[0];

  if (!folderId || !vaultKey || !file) {
    showStatus("Select folder, enter folder vault key, and choose a file.", true);
    return;
  }

  try {
    showStatus("Encrypting file in browser...");
    const encryptedFile = await encryptFile(file, vaultKey);
    const formData = new FormData();
    formData.append("file", encryptedFile.encryptedBlob, `${file.name}.enc`);
    formData.append("originalName", file.name);
    formData.append("mimeType", file.type || "application/octet-stream");
    formData.append("fileSize", String(file.size));
    formData.append("folderId", folderId);
    formData.append("vaultKey", vaultKey);
    formData.append("salt", encryptedFile.salt);
    formData.append("iv", encryptedFile.iv);

    const response = await fetch("/api/files/upload", {
      method: "POST",
      body: formData
    });

    const data = await readResponseData(response);
    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    fileInput.value = "";
    showStatus("Encrypted file uploaded to your secure folder.");
    loadFolders();
  } catch (error) {
    showStatus(error.message, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await request("/api/auth/logout", { method: "POST" });
    currentFolderId = null;
    currentFolderName = null;
    currentFolderVaultKey = "";
    currentFolderFiles = [];
    currentFolders = [];
    window.history.replaceState(null, "", window.location.pathname);
    showHomeLanding();
    showStatus("Logged out.");
  } catch (error) {
    showStatus(error.message, true);
  }
});

refreshBtn.addEventListener("click", loadFolders);
closePreviewBtn.addEventListener("click", closePreview);
backToHome.addEventListener("click", (event) => {
  event.preventDefault();
  window.location.hash = "";
});
brandHomeLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.history.replaceState(null, "", window.location.pathname);
    showHomeLanding();
  });
});
prevSlideBtn.addEventListener("click", () => {
  renderSlide(currentSlideIndex - 1);
  restartSlideInterval();
});
nextSlideBtn.addEventListener("click", () => {
  renderSlide(currentSlideIndex + 1);
  restartSlideInterval();
});
slideDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    renderSlide(Number(dot.dataset.slideDot));
    restartSlideInterval();
  });
});
previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) {
    closePreview();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !previewModal.classList.contains("hidden")) {
    closePreview();
  }
});
window.addEventListener("hashchange", syncAuthRouteFromLocation);

syncAuthRouteFromLocation();
renderSlide(0);
restartSlideInterval();
loadCurrentUser();
