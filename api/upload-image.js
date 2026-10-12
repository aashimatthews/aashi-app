
const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif"
]);

const MAX_FILE_SIZE = 4 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const {
    IMAGEKIT_PRIVATE_KEY,
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  } = process.env;

  if (
    !IMAGEKIT_PRIVATE_KEY ||
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY
  ) {
    return res.status(500).json({
      error: "Server environment variables are missing."
    });
  }

  try {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        error: "Please sign in as an administrator."
      });
    }

    // Verify the user's access token with Supabase.
    const userResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!userResponse.ok) {
      return res.status(401).json({
        error: "Your session is invalid. Please sign in again."
      });
    }

    const authUser = await userResponse.json();

    // Verify the administrator role and active account status.
    const profileUrl = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
    profileUrl.searchParams.set("select", "id,role,account_status");
    profileUrl.searchParams.set("id", `eq.${authUser.id}`);
    profileUrl.searchParams.set("limit", "1");

    const profileResponse = await fetch(profileUrl, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`
      }
    });

    if (!profileResponse.ok) {
      return res.status(403).json({
        error: "Unable to verify administrator permissions."
      });
    }

    const profiles = await profileResponse.json();
    const profile = profiles[0];

    if (
      !profile ||
      profile.role !== "admin" ||
      profile.account_status !== "active"
    ) {
      return res.status(403).json({
        error: "Administrator access required."
      });
    }

    const { file, fileName, mimeType } = req.body || {};

    if (
      typeof file !== "string" ||
      !file.startsWith("data:")
    ) {
      return res.status(400).json({
        error: "Choose an image to upload."
      });
    }

    const match = file.match(
      /^data:(image\/(?:jpeg|png|webp|avif));base64,([A-Za-z0-9+/]+={0,2})$/
    );

    if (!match) {
      return res.status(400).json({
        error: "Unsupported image format."
      });
    }

    const detectedType = match[1];
    const buffer = Buffer.from(match[2], "base64");

    if (
      !ALLOWED_TYPES.has(detectedType) ||
      (mimeType && mimeType !== detectedType)
    ) {
      return res.status(400).json({
        error: "Unsupported image format."
      });
    }

    if (!buffer.length || buffer.length > MAX_FILE_SIZE) {
      return res.status(413).json({
        error: "Images must be smaller than 4 MB."
      });
    }

    const safeName =
      typeof fileName === "string"
        ? fileName
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .slice(0, 100)
        : "aashiverse-image";

    const form = new FormData();
    form.append(
      "file",
      new Blob([buffer], { type: detectedType }),
      safeName
    );
    form.append("fileName", safeName);
    form.append("folder", "/aashiverse/public-posts");
    form.append("useUniqueFileName", "true");

    const imageKitResponse = await fetch(IMAGEKIT_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${IMAGEKIT_PRIVATE_KEY}:`).toString("base64")
      },
      body: form
    });

    const result = await imageKitResponse.json();

    if (!imageKitResponse.ok) {
      console.error("ImageKit upload failed:", result);
      return res.status(502).json({
        error: "ImageKit could not upload the image."
      });
    }

    return res.status(200).json({
      url: result.url,
      fileId: result.fileId,
      name: result.name
    });
  } catch (error) {
    console.error("Upload endpoint error:", error);
    return res.status(500).json({
      error: "The image upload failed. Please try again."
    });
  }
}
