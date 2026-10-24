import { useEffect, useState } from "react";
import {
  AddPhotoAlternateRounded,
  AutoAwesomeRounded,
  CategoryRounded,
  CollectionsRounded,
  CloudUploadRounded,
  ImageRounded,
  LogoutRounded,
  VideoLibraryRounded,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import "./App.css";

const API = "http://localhost:5001";

function App() {
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      console.info("[API] Loading posts and category counts", { API });
      const [postsResponse, statsResponse] = await Promise.all([
        fetch(`${API}/api/posts?page=1&limit=20`, { credentials: "include" }),
        fetch(`${API}/api/stats/categories`, { credentials: "include" }),
      ]);
      if (!postsResponse.ok || !statsResponse.ok) {
        const failedResponse = !postsResponse.ok ? postsResponse : statsResponse;
        const body = await failedResponse.json().catch(() => null);
        throw new Error(body?.message || `API request failed (${failedResponse.status}).`);
      }
      const [postData, statData] = await Promise.all([
        postsResponse.json(),
        statsResponse.json(),
      ]);
      setPosts(postData);
      setStats(statData);
    } catch (err) {
      console.error("[API] Failed to load posts or categories", { api: API, error: err });
      setError(err instanceof TypeError
        ? `Cannot reach the API at ${API}. Check that the backend is running.`
        : err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Ask the server whether the browser still has a valid login cookie.
    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        return data.user;
      })
      .then((currentUser) => {
        setUser(currentUser);
        if (currentUser) loadData();
      })
      .catch((err) => console.error("[Auth] Could not restore session:", err))
      .finally(() => setAuthLoading(false));
  }, []);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError("");
    setAuthBusy(true);
    const isSignup = authMode === "signup";

    try {
      const response = await fetch(`${API}/api/auth/${authMode}`, {
        method: "POST",
        credentials: "include", // Let the browser store/send the HTTP-only cookie.
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isSignup ? { name: authName } : {}),
          email: authEmail,
          password: authPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Authentication failed.");

      setUser(data.user);
      setAuthPassword("");
      setSuccess(isSignup ? "Your account is ready." : "Welcome back.");
      await loadData();
    } catch (err) {
      console.error(`[Auth] ${authMode} failed:`, err);
      setError(err.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setPosts([]);
      setStats([]);
      setSuccess("");
      setError("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (media) formData.set("media", media);

    try {
      console.info("[API] Submitting post", {
        url: `${API}/api/posts`,
        hasMedia: Boolean(media),
        mediaType: media?.type || null,
        mediaSizeBytes: media?.size || null,
      });
      const response = await fetch(`${API}/api/posts`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("[API] Post creation returned an error", {
          status: response.status,
          response: result,
        });
        throw new Error(result.message || `Could not save post (HTTP ${response.status}).`);
      }
      console.info("[API] Post saved", { id: result._id });
      setTitle("");
      setCategory("");
      setMedia(null);
      form.reset();
      setSuccess("Your post is live in the library.");
      await loadData();
    } catch (err) {
      console.error("[API] Post submission failed", { url: `${API}/api/posts`, error: err });
      setError(err instanceof TypeError
        ? `Cannot reach the API at ${API}. Check that the backend is running.`
        : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box className="min-h-screen px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <Container maxWidth="lg" disableGutters>
        <Box className="topbar mb-9 flex items-center justify-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar className="brand-mark"><CollectionsRounded /></Avatar>
            <Box>
              <Typography fontWeight={800} letterSpacing="-0.04em">little library</Typography>
              <Typography variant="caption" color="text.secondary">YOUR MEDIA, ALL IN ONE PLACE</Typography>
            </Box>
          </Stack>
          {user ? (
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Chip label={user.name} variant="outlined" className="space-chip" />
              <Button variant="text" startIcon={<LogoutRounded />} onClick={handleLogout}>Log out</Button>
            </Stack>
          ) : (
            <Chip icon={<AutoAwesomeRounded />} label="Personal space" variant="outlined" className="space-chip" />
          )}
        </Box>

        <Paper elevation={0} className="hero-panel mb-7 overflow-hidden">
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <Box className="hero-content relative z-10">
            <Chip label="A HOME FOR YOUR IDEAS" className="eyebrow-chip mb-4" />
            <Typography component="h1" className="hero-title" fontWeight={800}>
              Keep the things<br /><span>you want to remember.</span>
            </Typography>
            <Typography className="hero-copy" color="text.secondary">
              Save a thought, share a moment, and find it again whenever you need it.
            </Typography>
            <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap className="hero-pills">
              <Chip icon={<ImageRounded />} label="Photos" />
              <Chip icon={<VideoLibraryRounded />} label="Short videos" />
              <Chip icon={<CategoryRounded />} label="Your categories" />
            </Stack>
          </Box>
        </Paper>

        {error && <Alert severity="error" className="mb-5" onClose={() => setError("")}>{error}</Alert>}
        {success && <Alert severity="success" className="mb-5" onClose={() => setSuccess("")}>{success}</Alert>}

        {authLoading ? (
          <Paper elevation={0} className="auth-panel"><LinearProgress /></Paper>
        ) : !user ? (
          <Paper component="section" elevation={0} className="auth-panel">
            <Avatar className="section-icon auth-icon"><CollectionsRounded /></Avatar>
            <Typography variant="h5" fontWeight={800} className="mb-1">
              {authMode === "signup" ? "Create your account" : "Welcome back"}
            </Typography>
            <Typography color="text.secondary" className="mb-5">
              {authMode === "signup" ? "Make a little space for the things you want to keep." : "Log in to see your personal library."}
            </Typography>
            <form onSubmit={handleAuthSubmit} className="post-form">
              {authMode === "signup" && <TextField label="Your name" value={authName}
                onChange={(event) => setAuthName(event.target.value)} required autoComplete="name" />}
              <TextField label="Email" type="email" value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)} required autoComplete="email" />
              <TextField label="Password" type="password" value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)} required
                inputProps={{ minLength: 8 }} autoComplete={authMode === "signup" ? "new-password" : "current-password"} />
              <Button type="submit" variant="contained" size="large" disabled={authBusy}>
                {authBusy ? "Please wait…" : authMode === "signup" ? "Create account" : "Log in"}
              </Button>
            </form>
            <Button className="auth-toggle" onClick={() => {
              setAuthMode(authMode === "signup" ? "login" : "signup");
              setError("");
            }}>
              {authMode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
            </Button>
          </Paper>
        ) : (
          <>
        <Box className="content-layout mb-12">
          <Paper component="section" elevation={0} className="composer-panel">
            <Stack direction="row" spacing={1.5} alignItems="center" className="mb-5">
              <Avatar className="section-icon"><AddPhotoAlternateRounded /></Avatar>
              <Box>
                <Typography variant="h6" fontWeight={800} letterSpacing="-0.03em">Add to your library</Typography>
                <Typography variant="body2" color="text.secondary">Start with a title and a category.</Typography>
              </Box>
            </Stack>
            <form onSubmit={handleSubmit} className="post-form">
              <TextField name="title" label="Post title" placeholder="A little note to future me…"
                value={title} onChange={(event) => setTitle(event.target.value)} required inputProps={{ maxLength: 120 }} />
              <TextField name="category" label="Category" placeholder="Travel, recipes, learning…"
                value={category} onChange={(event) => setCategory(event.target.value)} required inputProps={{ maxLength: 40 }} />
              <Button component="label" variant="outlined" startIcon={<CloudUploadRounded />} className="upload-button">
                {media ? media.name : "Choose a photo or video"}
                <input hidden type="file" accept="image/jpeg,image/png,image/webp,video/mp4"
                  onChange={(event) => setMedia(event.target.files[0] || null)} />
              </Button>
              <Typography variant="caption" color="text.secondary" className="upload-hint">
                JPG, PNG, WebP, or MP4 · up to 10 MB
              </Typography>
              <Button type="submit" variant="contained" size="large" endIcon={<AutoAwesomeRounded />} disabled={saving}>
                {saving ? "Saving your post…" : "Save to library"}
              </Button>
            </form>
          </Paper>

          <Paper component="section" elevation={0} className="category-panel">
            <Stack direction="row" justifyContent="space-between" alignItems="center" className="mb-4">
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>Your categories</Typography>
                <Typography variant="body2" color="text.secondary">A quick look at what you’ve saved.</Typography>
              </Box>
              <Avatar className="count-avatar">{stats.length}</Avatar>
            </Stack>
            <Divider className="mb-4" />
            {stats.length ? (
              <Stack spacing={1.2}>
                {stats.map((item, index) => (
                  <Box key={item.category} className="category-row">
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Avatar className={`category-dot dot-${index % 4}`}><CategoryRounded fontSize="small" /></Avatar>
                      <Typography fontWeight={650}>{item.category}</Typography>
                    </Stack>
                    <Chip size="small" label={item.count} className="category-count" />
                  </Box>
                ))}
              </Stack>
            ) : (
              <Box className="category-empty"><CategoryRounded />
                <Typography variant="body2" color="text.secondary">Your categories will show up here.</Typography>
              </Box>
            )}
          </Paper>
        </Box>

        <Box component="section" className="library-section">
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "end" }} className="mb-5" spacing={1}>
            <Box>
              <Typography variant="overline" className="section-kicker">THE COLLECTION</Typography>
              <Typography component="h2" variant="h4" fontWeight={800} letterSpacing="-0.05em">Your saved posts</Typography>
            </Box>
            <Chip icon={<CollectionsRounded />} label={`${posts.length} ${posts.length === 1 ? "post" : "posts"}`} className="post-count" />
          </Stack>
          {loading && <LinearProgress className="loading-line mb-4" />}
          {!loading && posts.length === 0 ? (
            <Paper elevation={0} className="empty-state">
              <Avatar className="empty-icon"><AddPhotoAlternateRounded /></Avatar>
              <Typography variant="h6" fontWeight={800}>Your first post starts here</Typography>
              <Typography color="text.secondary">Add a note or upload a favorite moment. It’ll be waiting for you here.</Typography>
            </Paper>
          ) : (
            <Box className="post-grid">
              {posts.map((post) => (
                <Card elevation={0} className="post-card" key={post._id}>
                  {post.mediaType.startsWith("image/") && <Box component="img" className="post-media" src={`${API}${post.mediaUrl}`} alt={post.title} />}
                  {post.mediaType.startsWith("video/") && <Box component="video" className="post-media" src={`${API}${post.mediaUrl}`} controls />}
                  {!post.mediaType && <Box className="post-placeholder"><CollectionsRounded /></Box>}
                  <CardContent className="post-card-content">
                    <Chip size="small" label={post.category} className="post-category mb-2" />
                    <Typography variant="h6" fontWeight={750} className="post-title">{post.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
          </>
        )}
        <Typography component="footer" variant="caption" color="text.secondary" className="app-footer">
          A small space for all the things worth keeping.
        </Typography>
      </Container>
    </Box>
  );
}

export default App;
