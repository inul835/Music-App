/* =====================================================================
 * Hum · configuration — the ONLY file you need to edit
 * ---------------------------------------------------------------------
 * Full walkthrough: user-guide.md (≈10 minutes, no credit card needed)
 * ===================================================================== */
window.HUM_CONFIG = {

  /* 1) The Google Drive folder that holds your music.
   *    Open the folder in drive.google.com — the ID is the long string
   *    at the end of the URL:
   *    https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9IjKlMnOpQrStUvW
   *                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   *    The folder must be shared as "Anyone with the link · Viewer".   */
  DRIVE_FOLDER_ID: 'PASTE_YOUR_FOLDER_ID_HERE',

  /* 2) A Google Drive API key.
   *    console.cloud.google.com → create project → enable "Google Drive API"
   *    → Credentials → Create credentials → API key.
   *    Restrict it to the Drive API + your website's domain (guide §3.4). */
  API_KEY: 'PASTE_YOUR_API_KEY_HERE',

  /* 3) OPTIONAL: a simple password gate shown before the library opens.
   *    Leave '' to disable. Note: this is a light privacy screen, not
   *    real security — your Drive sharing settings are the real gate. */
  ACCESS_PASSWORD: '',

  /* 4) App name shown on the splash screen and browser tab. */
  APP_NAME: 'Hum'

  /* No server, no secrets, no metadata files — everything else is
   * discovered automatically from your Drive folder. That's it. */
};
