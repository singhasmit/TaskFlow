import { useCallback, useEffect, useState } from "react";
import api from "./api";

const blankJob = {
  type: "email",
  priority: 5,
  attempts: 3,
  payload: { to: "", subject: "", simulateFailure: false },
};
const label = (value) => value.replace("_", " ");

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const { data } = await api.post(
        `/auth/${mode === "login" ? "login" : "register"}`,
        form,
      );
      onAuth(data);
    } catch (e) {
      setError(e.response?.data?.error || "Unable to authenticate");
    }
  }
  return (
    <main className="auth">
      <section className="card">
        <p className="eyebrow">BACKGROUND JOBS, EXPLAINED</p>
        <h1>TaskFlow</h1>
        <p>Submit work now. Process it reliably in the background.</p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <input
              required
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            required
            minLength="8"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error && <p className="error">{error}</p>}
          <button>{mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <button
          className="link"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account?" : "Already have an account?"}
        </button>
      </section>
    </main>
  );
}

function JobForm({ onCreated }) {
  const [job, setJob] = useState(blankJob);
  const [error, setError] = useState("");
  const updatePayload = (key, value) =>
    setJob({ ...job, payload: { ...job.payload, [key]: value } });
  async function submit(event) {
    event.preventDefault();
    setError("");
    const payload =
      job.type === "report"
        ? {
            reportName: job.payload.reportName || "Weekly report",
            simulateFailure: job.payload.simulateFailure,
          }
        : job.payload;
    const scheduledAt = job.scheduledAt
      ? new Date(job.scheduledAt).toISOString()
      : undefined;
    try {
      await api.post(
        "/jobs",
        { ...job, payload, scheduledAt },
        { headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      setJob(blankJob);
      onCreated();
    } catch (e) {
      setError(e.response?.data?.error || "Job could not be submitted");
    }
  }
  return (
    <section className="card">
      <h2>New job</h2>
      <form onSubmit={submit} className="form-grid">
        <select
          value={job.type}
          onChange={(e) =>
            setJob({ ...job, type: e.target.value, payload: {} })
          }
        >
          <option value="email">Email delivery</option>
          <option value="report">Report generation</option>
        </select>
        {job.type === "email" ? (
          <>
            <input
              required
              type="email"
              placeholder="Recipient"
              value={job.payload.to || ""}
              onChange={(e) => updatePayload("to", e.target.value)}
            />
            <input
              placeholder="Subject"
              value={job.payload.subject || ""}
              onChange={(e) => updatePayload("subject", e.target.value)}
            />
          </>
        ) : (
          <input
            required
            placeholder="Report name"
            value={job.payload.reportName || ""}
            onChange={(e) => updatePayload("reportName", e.target.value)}
          />
        )}
        <label>
          Priority{" "}
          <input
            type="number"
            min="1"
            max="10"
            value={job.priority}
            onChange={(e) =>
              setJob({ ...job, priority: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Attempts{" "}
          <input
            type="number"
            min="1"
            max="5"
            value={job.attempts}
            onChange={(e) =>
              setJob({ ...job, attempts: Number(e.target.value) })
            }
          />
        </label>
        <label className="md:col-span-2">
          Schedule later{" "}
          <input
            type="datetime-local"
            value={job.scheduledAt || ""}
            onChange={(e) => setJob({ ...job, scheduledAt: e.target.value })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={job.payload.simulateFailure || false}
            onChange={(e) => updatePayload("simulateFailure", e.target.checked)}
          />{" "}
          Simulate failure
        </label>
        {error && <p className="error">{error}</p>}
        <button>Queue job</button>
      </form>
    </section>
  );
}

function Dashboard({ user, logout }) {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({});
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/jobs/dashboard");
      setJobs(data.jobs);
      setStats(data.stats);
      setError("");
    } catch (e) {
      setError(e.response?.data?.error || "Could not load jobs");
    }
  }, []);
  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);
  async function action(name) {
    try {
      const { data } = await api.post(`/jobs/${selected._id}/${name}`);
      setSelected(data.job);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Action failed");
    }
  }
  const keys = ["queued", "active", "completed", "failed"];
  return (
    <main className="shell">
      <header>
        <div>
          <p className="eyebrow">TASKFLOW</p>
          <h1>Welcome, {user.name}</h1>
        </div>
        <button className="secondary" onClick={logout}>
          Sign out
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      <section className="stats">
        {keys.map((key) => (
          <article className="stat" key={key}>
            <span>{label(key)}</span>
            <strong>{stats[key] || 0}</strong>
          </article>
        ))}
      </section>
      <JobForm onCreated={load} />
      <section className="card">
        <div className="section-head">
          <h2>Recent jobs</h2>
          <button className="secondary" onClick={load}>
            Refresh
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Attempts</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job._id} onClick={() => setSelected(job)}>
                  <td>{job.type}</td>
                  <td>
                    <span className={`badge ${job.status}`}>
                      {label(job.status)}
                    </span>
                  </td>
                  <td>{job.priority}</td>
                  <td>
                    {job.attemptsMade}/{job.attempts}
                  </td>
                  <td>{new Date(job.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan="5">No jobs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <section className="card details">
          <div className="section-head">
            <h2>Job details</h2>
            <div className="actions">
              {["queued", "queue_pending"].includes(selected.status) && (
                <button className="secondary" onClick={() => action("cancel")}>
                  Cancel job
                </button>
              )}
              {selected.status === "failed" && (
                <button onClick={() => action("retry")}>Retry job</button>
              )}
              <button className="secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
          <h3>Event timeline</h3>
          <ul className="timeline">
            {(selected.events || [])
              .slice()
              .reverse()
              .map((event, index) => (
                <li key={index}>
                  <strong>{label(event.type)}</strong>
                  <span>{event.message}</span>
                  <time>{new Date(event.at).toLocaleString()}</time>
                </li>
              ))}
          </ul>
          <pre>{JSON.stringify(selected, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem("taskflow_token");
    const user = localStorage.getItem("taskflow_user");
    return token && user ? { token, user: JSON.parse(user) } : null;
  });
  function onAuth(data) {
    localStorage.setItem("taskflow_token", data.token);
    localStorage.setItem("taskflow_user", JSON.stringify(data.user));
    setSession(data);
  }
  function logout() {
    localStorage.removeItem("taskflow_token");
    localStorage.removeItem("taskflow_user");
    setSession(null);
  }
  return session ? (
    <Dashboard user={session.user} logout={logout} />
  ) : (
    <Auth onAuth={onAuth} />
  );
}
