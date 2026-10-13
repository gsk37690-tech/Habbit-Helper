"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type User = { id: string; username: string; email: string; level: number; xp: number; gold: number; streak: number };
type QuestType = "Main" | "Daily" | "Side" | "Weekly";
type QuestStatus = "active" | "completed" | "stopped" | "failed";
type Quest = { id: string; title: string; description: string; type: QuestType; difficulty: "Easy" | "Medium" | "Hard" | "Legendary"; xp: number; gold: number; due: string; progress: number; tag: string; completed: boolean; status?: QuestStatus; pinned?: boolean; createdAt?: string; completedAt?: string | Date; completedDate?: string };
type QuestFilter = "All quests" | QuestType;
type AppView = "board" | "calendar" | "inventory" | "character" | "achievements";
type InventoryItem = { id: string; name: string; description: string; icon: string; rarity: string; quantity: number; usable: boolean };
type Avatar = { id: string; name: string; className: string; icon: string; requiredLevel: number; description: string };
type Achievement = { name: string; description: string; icon: string; progress: number; target: number; endgame?: boolean };

const filters: QuestFilter[] = ["All quests", "Main", "Daily", "Side", "Weekly"];
const questTypes: QuestType[] = ["Main", "Daily", "Side", "Weekly"];
const startingInventory: InventoryItem[] = [
  { id: "ember-elixir", name: "Ember Elixir", description: "A warm draught that grants a small XP surge.", icon: "♨", rarity: "Rare", quantity: 2, usable: true },
  { id: "frost-rune", name: "Frostkeep Rune", description: "Protects a streak from one missed day.", icon: "❄", rarity: "Epic", quantity: 1, usable: true },
  { id: "dawn-feather", name: "Dawnfeather Continuum", description: "Continues a daily quest into the next sunrise.", icon: "羽", rarity: "Legendary", quantity: 1, usable: true },
  { id: "golden-compass", name: "Golden Compass", description: "A keepsake earned by finding your focus.", icon: "⌖", rarity: "Uncommon", quantity: 1, usable: false },
];
const avatars: Avatar[] = [
  { id: "wayfinder", name: "Wayfinder", className: "Quest scout", icon: "✧", requiredLevel: 1, description: "The path begins with one brave step." },
  { id: "knight", name: "Knight", className: "Iron oath", icon: "♞", requiredLevel: 3, description: "Steadfast under pressure and deadlines." },
  { id: "warrior", name: "Warrior", className: "Stormblade", icon: "⚔", requiredLevel: 5, description: "Turns difficult goals into decisive victories." },
  { id: "mage", name: "Mage", className: "Arcane scholar", icon: "✦", requiredLevel: 8, description: "Channels curiosity into powerful rituals." },
  { id: "barbarian", name: "Barbarian", className: "Mountain heart", icon: "♜", requiredLevel: 12, description: "Unstoppable when the final boss appears." },
];

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", "x-client-date": dateKey(new Date()), ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}
function normalizeQuest(quest: Quest): Quest {
  const isDaily = quest.type === "Daily";
  let isCompleted = quest.completed === true;
  let status = quest.status ?? (isCompleted ? "completed" : "active");
  if (isDaily && isCompleted && quest.completedAt) {
    const compDate = dateKey(new Date(quest.completedAt));
    const today = dateKey(new Date());
    if (compDate !== today) {
      isCompleted = false;
      status = "active";
    }
  }
  return { ...quest, completed: isCompleted, status, pinned: quest.pinned === true };
}
function questDeadline(quest: Quest, today: Date) { if (quest.due === "Today") return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59); if (quest.due === "Tomorrow") return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 23, 59, 59); const parsed = new Date(quest.due); return Number.isNaN(parsed.getTime()) ? null : parsed; }
function questStart(quest: Quest, deadline: Date) { const parsed = quest.createdAt ? new Date(quest.createdAt) : deadline; return Number.isNaN(parsed.getTime()) ? deadline : parsed; }

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "" });
  const [appView, setAppView] = useState<AppView>("board");
  const [inventory, setInventory] = useState(startingInventory);
  const [selectedAvatar, setSelectedAvatar] = useState("wayfinder");
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(() => dateKey(new Date()));
  const [questView, setQuestView] = useState<"active" | "completed">("active");
  const [activeFilter, setActiveFilter] = useState<QuestFilter>("All quests");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newQuest, setNewQuest] = useState("");
  const [newQuestType, setNewQuestType] = useState<QuestType>("Side");
  const [newQuestDue, setNewQuestDue] = useState("");
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<QuestType>("Side");
  const [editDue, setEditDue] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3000); };
  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      if (active) setCheckingSession(false);
    }, 1200);

    api("/api/auth/me")
      .then((data) => {
        if (active) setUser(data?.user ?? null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) {
          clearTimeout(timeout);
          setCheckingSession(false);
        }
      });

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => { if (user) api("/api/quests").then((data) => setQuests(data.quests.map(normalizeQuest))).catch((error) => notify(error.message)); }, [user]);
  useEffect(() => {
    function refreshOnActive() {
      if (user && document.visibilityState === "visible") {
        api("/api/quests").then((data) => setQuests(data.quests.map(normalizeQuest))).catch(() => undefined);
        api("/api/auth/me").then((data) => setUser(data.user)).catch(() => undefined);
      }
    }
    window.addEventListener("focus", refreshOnActive);
    document.addEventListener("visibilitychange", refreshOnActive);
    return () => {
      window.removeEventListener("focus", refreshOnActive);
      document.removeEventListener("visibilitychange", refreshOnActive);
    };
  }, [user]);

  const visibleQuests = useMemo(() => quests.filter((quest) => {
    const status = quest.status ?? (quest.completed ? "completed" : "active");
    const inView = questView === "completed" ? status === "completed" && quest.type !== "Daily" : status === "active" || quest.type === "Daily" && status === "completed";
    return inView && (activeFilter === "All quests" || quest.type === activeFilter) && quest.title.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned)), [activeFilter, questView, quests, search]);
  const completedCount = quests.filter((quest) => (quest.status ?? (quest.completed ? "completed" : "active")) === "completed" && quest.type !== "Daily").length;
  const levelXp = user?.xp ?? 0;
  const levelTarget = Math.max(500, (user?.level ?? 1) * 500);
  const achievements: Achievement[] = [
    { name: "Day One", description: "Create your character and enter the realm.", icon: "✧", progress: 1, target: 1 },
    { name: "First Light", description: "Log in for the first time.", icon: "☼", progress: 1, target: 1 },
    { name: "Novice Adventurer", description: "Complete 10 non-daily quests.", icon: "◇", progress: completedCount, target: 10 },
    { name: "Streakkeeper", description: "Maintain a seven-day streak.", icon: "♨", progress: user?.streak ?? 0, target: 7 },
    { name: "Realm Walker", description: "Reach level 10.", icon: "◈", progress: user?.level ?? 1, target: 10 },
    { name: "Questmaster", description: "Complete 100 quests.", icon: "✹", progress: completedCount, target: 100, endgame: true },
    { name: "Eternal Flame", description: "Maintain a 100-day streak.", icon: "♨", progress: user?.streak ?? 0, target: 100, endgame: true },
    { name: "Dragon of Discipline", description: "Earn 50,000 XP.", icon: "🐉", progress: user?.xp ?? 0, target: 50000, endgame: true },
    { name: "The Final Boss", description: "Reach level 50 and complete 250 quests.", icon: "☠", progress: Math.min(user?.level ?? 1, completedCount / 5), target: 50, endgame: true },
  ];
  const calendarDays = useMemo(() => {
    if (!calendarDate) return [];
    const first = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  }, [calendarDate]);
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);
  const calendarQuests = useMemo(() => {
    const map = new Map<string, Quest[]>();
    if (!calendarDate) return map;
    const today = new Date();
    quests.filter((quest) => (quest.status ?? (quest.completed ? "completed" : "active")) === "active").forEach((quest) => {
      const deadline = questDeadline(quest, today);
      if (!deadline) return;
      const start = questStart(quest, deadline);
      calendarDays.forEach((day) => {
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
        if (dayStart >= startDay && dayStart <= deadlineDay) { const key = dateKey(day); map.set(key, [...(map.get(key) ?? []), quest]); }
      });
    });
    return map;
  }, [calendarDate, calendarDays, quests]);
  const selectedDayQuests = selectedDay ? calendarQuests.get(selectedDay) ?? [] : [];

  async function submitAuth(event: FormEvent) { event.preventDefault(); setBusy(true); try { const data = await api(`/api/auth/${authMode}`, { method: "POST", body: JSON.stringify(authForm) }); setUser(data.user); notify(authMode === "register" ? "Your quest hall is ready." : "Welcome back, wayfinder."); } catch (error) { notify(error instanceof Error ? error.message : "Unable to sign in."); } finally { setBusy(false); } }
  async function addQuest() { if (!newQuest.trim()) return; setBusy(true); try { const data = await api("/api/quests", { method: "POST", body: JSON.stringify({ title: newQuest, type: newQuestType, due: newQuestDue || "No deadline" }) }); setQuests((current) => [normalizeQuest(data.quest), ...current]); setNewQuest(""); setNewQuestType("Side"); setNewQuestDue(""); setShowForm(false); notify("New quest added to your log"); } catch (error) { notify(error instanceof Error ? error.message : "Unable to create quest."); } finally { setBusy(false); } }
  async function completeQuest(quest: Quest) {
    setBusy(true);
    try {
      const data = await api(`/api/quests/${quest.id}/complete`, { method: "POST" });
      setQuests((current) => current.map((item) => item.id === quest.id ? normalizeQuest(data.quest) : item));
      if (data.reward) {
        if (data.user) {
          setUser(data.user);
        } else {
          setUser((current) => current ? { ...current, xp: current.xp + data.reward.xp, gold: current.gold + data.reward.gold, streak: Math.max(1, current.streak + 1) } : current);
        }
        const streakCount = data.user?.streak ?? (user ? user.streak + 1 : 1);
        notify(`Quest complete: +${data.reward.xp} XP and +${data.reward.gold} gold · Streak: ${streakCount} ${streakCount === 1 ? "day" : "days"} 🔥`);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to complete quest.");
    } finally {
      setBusy(false);
    }
  }

  async function resetDailyQuest(quest: Quest) {
    setBusy(true);
    try {
      const data = await api(`/api/quests/${quest.id}/reset`, { method: "POST" });
      setQuests((current) => current.map((item) => item.id === quest.id ? normalizeQuest(data.quest) : item));
      notify("Daily quest reset — ready to clear once more!");
    } catch {
      await updateQuest(quest, { status: "active", progress: 0, completed: false, due: "Today" }, "Daily quest reset");
    } finally {
      setBusy(false);
    }
  }

  async function updateQuest(quest: Quest, updates: Record<string, unknown>, message: string) { setBusy(true); try { const data = await api(`/api/quests/${quest.id}`, { method: "PATCH", body: JSON.stringify(updates) }); setQuests((current) => current.map((item) => item.id === quest.id ? normalizeQuest(data.quest) : item)); notify(message); } catch (error) { notify(error instanceof Error ? error.message : "Unable to update quest."); } finally { setBusy(false); } }
  async function clearQuest(quest: Quest) {
    if (quest.type === "Daily") {
      return resetDailyQuest(quest);
    }
    setBusy(true);
    try {
      await api(`/api/quests/${quest.id}`, { method: "DELETE" });
      setQuests((current) => current.filter((item) => item.id !== quest.id));
      notify("Completed quest cleared");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to clear quest.");
    } finally {
      setBusy(false);
    }
  }
  function beginEdit(quest: Quest) { setEditingQuestId(quest.id); setEditTitle(quest.title); setEditType(quest.type); setEditDue(quest.due === "No deadline" ? "" : quest.due); }
  async function saveEdit(quest: Quest) { if (!editTitle.trim()) return; await updateQuest(quest, { title: editTitle.trim(), type: editType, due: editDue || "No deadline" }, "Quest updated"); setEditingQuestId(null); }
  async function logout() { await api("/api/auth/logout", { method: "POST" }); setUser(null); setQuests([]); }

  if (checkingSession) return <div className="loading-screen">Opening your quest hall...</div>;
  if (!user) return <main className="auth-shell"><div className="auth-art"><span className="brand-mark">✦</span><p className="auth-kicker">QUESTLIFE RPG</p><h1>Make today<br /><em>legendary.</em></h1><p>Turn the everyday into an adventure worth showing up for.</p><div className="auth-rune">✧</div></div><form className="auth-form" onSubmit={submitAuth}><span className="eyebrow">YOUR QUEST BEGINS HERE</span><h2>{authMode === "login" ? "Welcome back, wayfinder" : "Create your character"}</h2><p className="auth-help">{authMode === "login" ? "Sign in to return to your quest hall. Demo: wayfinder@questlife.com / wayfinder123" : "Start fresh. Your quest log will be yours alone."}</p>{authMode === "register" && <label>Username<input required minLength={2} value={authForm.username} onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })} placeholder="Your adventurer name" /></label>}<label>Email<input required type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="you@example.com" /></label><label>Password<input required minLength={8} type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="At least 8 characters" /></label><button className="auth-submit" disabled={busy}>{busy ? "Opening the gate..." : authMode === "login" ? "Enter the quest hall" : "Create my character"}</button><button type="button" className="auth-switch" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button></form>{toast && <div className="toast">✦ {toast}</div>}</main>;

  function consumeInventoryItem(item: InventoryItem) {
    if (!item.usable || item.quantity < 1) return;
    setInventory((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry));
    notify(`${item.name} used`);
  }

  function renderInventory() {
    return <section className="collection-panel"><div className="collection-heading"><div><span className="eyebrow">THE WAYFINDER&apos;S PACK</span><h2>Inventory</h2><p>Keep your rarest tools close. Every item has a story.</p></div><span className="collection-count">{inventory.reduce((total, item) => total + item.quantity, 0)} items</span></div><div className="inventory-grid">{inventory.map((item) => <article className={`inventory-card ${item.rarity.toLowerCase()}`} key={item.id}><div className="inventory-icon">{item.icon}</div><div className="inventory-copy"><span className="rarity-label">{item.rarity}</span><h3>{item.name}</h3><p>{item.description}</p><div className="inventory-footer"><span>Quantity <b>{item.quantity}</b></span>{item.usable && <button className="use-item" onClick={() => consumeInventoryItem(item)} disabled={!item.quantity}>Use item</button>}</div></div></article>)}</div></section>;
  }

  function renderCharacter() {
    const activeAvatar = avatars.find((avatar) => avatar.id === selectedAvatar) ?? avatars[0];
    return <section className="collection-panel"><div className="collection-heading"><div><span className="eyebrow">YOUR LEGEND</span><h2>Character</h2><p>Unlock new identities as your legend grows.</p></div><span className="level-badge">Level {user?.level}</span></div><div className="character-layout"><div className="character-sheet"><div className="large-avatar">{activeAvatar.icon}</div><span className="eyebrow gold">CURRENT ASPECT</span><h3>{activeAvatar.name}</h3><strong>{activeAvatar.className}</strong><p>{activeAvatar.description}</p><div className="character-xp"><span>XP mastery</span><b>{levelXp} / {levelTarget}</b></div><div className="xp-track"><span style={{ width: `${Math.min(100, levelXp / levelTarget * 100)}%` }} /></div></div><div className="avatar-grid">{avatars.map((avatar) => { const unlocked = (user?.level ?? 1) >= avatar.requiredLevel; return <button key={avatar.id} className={`avatar-option ${selectedAvatar === avatar.id ? "selected" : ""} ${unlocked ? "" : "locked"}`} onClick={() => unlocked && setSelectedAvatar(avatar.id)} disabled={!unlocked}><span>{unlocked ? avatar.icon : "▧"}</span><strong>{avatar.name}</strong><small>{unlocked ? avatar.className : `Unlocks at level ${avatar.requiredLevel}`}</small></button>; })}</div></div></section>;
  }

  function renderAchievements() {
    return <section className="collection-panel"><div className="collection-heading"><div><span className="eyebrow">HONORS OF THE REALM</span><h2>Achievements</h2><p>Small victories become a legend worth remembering.</p></div><span className="collection-count">{achievements.filter((achievement) => achievement.progress >= achievement.target).length} unlocked</span></div><div className="achievement-groups"><div><h3 className="group-title">Milestones</h3><div className="achievement-grid">{achievements.filter((achievement) => !achievement.endgame).map((achievement) => renderAchievement(achievement))}</div></div><div><h3 className="group-title endgame-title">Endgame legends</h3><div className="achievement-grid">{achievements.filter((achievement) => achievement.endgame).map((achievement) => renderAchievement(achievement))}</div></div></div></section>;
  }

  function renderAchievement(achievement: Achievement) {
    const unlocked = achievement.progress >= achievement.target;
    const percent = Math.min(100, achievement.progress / achievement.target * 100);
    return <article className={`achievement-card ${unlocked ? "unlocked" : "locked"}`} key={achievement.name}><div className="achievement-icon">{unlocked ? achievement.icon : "?"}</div><div className="achievement-copy"><div className="achievement-top"><h4>{achievement.name}</h4><span>{unlocked ? "Unlocked" : `${Math.round(percent)}%`}</span></div><p>{achievement.description}</p>{!unlocked && <div className="achievement-track"><span style={{ width: `${percent}%` }} /></div>}</div></article>;
  }

  function renderQuestCard(quest: Quest) {
    return <article className={`quest-card ${quest.type.toLowerCase()} ${quest.pinned ? "pinned" : ""}`} key={quest.id}><div className="quest-top"><span className="quest-type">{quest.type === "Main" ? "◆" : quest.type === "Daily" ? "↻" : "◇"} {quest.type} quest</span><div className="quest-card-tools"><button className="edit-button" onClick={() => beginEdit(quest)} aria-label={`Edit ${quest.title}`}>✎</button><button className={quest.pinned ? "pin-button pinned" : "pin-button"} onClick={() => updateQuest(quest, { pinned: !quest.pinned }, quest.pinned ? "Quest unpinned" : "Quest pinned")} aria-label={quest.pinned ? "Unpin quest" : "Pin quest"}>⌖</button><span className={`difficulty ${quest.difficulty.toLowerCase()}`}>{quest.difficulty}</span></div></div>{editingQuestId === quest.id ? <div className="edit-form"><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} aria-label="Quest title" /><select value={editType} onChange={(event) => setEditType(event.target.value as QuestType)} aria-label="Quest type">{questTypes.map((type) => <option key={type} value={type}>{type} quest</option>)}</select><input className="deadline-input" type="datetime-local" value={editDue} onChange={(event) => setEditDue(event.target.value)} aria-label="Quest deadline" /><div><button className="complete" onClick={() => saveEdit(quest)} disabled={busy}>Save</button><button className="quiet-action" onClick={() => setEditingQuestId(null)}>Cancel</button></div></div> : <><h3>{quest.title}</h3><p>{quest.description || "A new mission from your quest hall."}</p><div className="quest-meta"><span>◷ {quest.due}</span><span className="tag">{quest.tag}</span></div></>}<div className="quest-footer"><div className="rewards"><span>✦ <b>{quest.xp}</b> XP</span><span>◇ <b>{quest.gold}</b> gold</span></div>{quest.status === "completed" ? <div className="completed-actions"><span className="completed-label">✓ Completed today</span>{quest.type === "Daily" ? <button className="clear-button" onClick={() => resetDailyQuest(quest)} disabled={busy} title="Reset daily quest to complete it again">↻ Reset for today</button> : <button className="clear-button" onClick={() => clearQuest(quest)} disabled={busy}>Clear quest</button>}</div> : <div className="quest-actions"><button className="quiet-action" onClick={() => updateQuest(quest, { status: "stopped" }, "Quest stopped")}>Stop</button><button className="quiet-action danger" onClick={() => updateQuest(quest, { status: "failed" }, "Quest marked as failed")}>Fail</button><button className="complete" onClick={() => completeQuest(quest)} disabled={busy}>Complete quest</button></div>}</div></article>;
  }

  function renderCalendar() {
    const todayKey = dateKey(new Date());
    const monthTitle = calendarDate
      ? calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : "Calendar";

    return (
      <section className="calendar-panel" aria-label="Quest schedule calendar" itemScope itemType="https://schema.org/ScheduleAction">
        <div className="calendar-header">
          <div>
            <span className="eyebrow">QUEST SCHEDULE</span>
            <h2>{monthTitle}</h2>
            <p>Active quests appear on every day up to their deadline.</p>
          </div>
          <div className="calendar-nav" role="toolbar" aria-label="Calendar month navigation">
            <button
              onClick={() => calendarDate && setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setCalendarDate(now);
                setSelectedDay(dateKey(now));
              }}
            >
              Today
            </button>
            <button
              onClick={() => calendarDate && setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              →
            </button>
          </div>
        </div>

        <div className="calendar-layout">
          <div className="calendar-main">
            <div className="calendar-grid" role="grid" aria-label={`Monthly quest schedule for ${monthTitle}`}>
              <div className="calendar-weekdays" role="row" aria-label="Days of the week">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                  <span
                    key={day}
                    role="columnheader"
                    aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][idx]}
                  >
                    {day}
                  </span>
                ))}
              </div>
              {calendarWeeks.map((week, weekIndex) => (
                <div key={weekIndex} role="row" className="calendar-row" aria-label={`Week ${weekIndex + 1}`}>
                  {week.map((day) => {
                    const key = dateKey(day);
                    const dayQuests = calendarQuests.get(key) ?? [];
                    const sameMonth = calendarDate ? day.getMonth() === calendarDate.getMonth() : true;
                    const isToday = key === todayKey;
                    const isSelected = selectedDay === key;

                    return (
                      <button
                        key={key}
                        role="gridcell"
                        className={`calendar-day ${sameMonth ? "" : "muted"} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
                        onClick={() => {
                          setSelectedDay(key);
                          if (typeof window !== "undefined" && window.innerWidth < 960) {
                            setTimeout(() => {
                              const el = document.getElementById("calendar-day-details");
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                            }, 50);
                          }
                        }}
                        aria-label={`${day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${dayQuests.length} quests${isToday ? ", Today" : ""}`}
                        aria-selected={isSelected}
                        aria-current={isToday ? "date" : undefined}
                      >
                        <div className="day-top">
                          <time dateTime={key} className="day-number">{day.getDate()}</time>
                          {isToday && <span className="today-badge">Today</span>}
                        </div>
                        <div className="day-quests">
                          {dayQuests.slice(0, 3).map((quest) => (
                            <span className={`calendar-quest ${quest.type.toLowerCase()}`} key={quest.id} title={quest.title}>
                              {quest.title}
                            </span>
                          ))}
                          {dayQuests.length > 3 && <span className="more-quests">+{dayQuests.length - 3} more</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="calendar-legend" aria-label="Quest type legend">
              <span className="legend-item"><i className="legend-dot main" /> Main quest</span>
              <span className="legend-item"><i className="legend-dot daily" /> Daily quest</span>
              <span className="legend-item"><i className="legend-dot side" /> Side quest</span>
              <span className="legend-item"><i className="legend-dot weekly" /> Weekly quest</span>
            </div>
          </div>

          <aside className="calendar-detail-panel" id="calendar-day-details" tabIndex={-1} aria-live="polite" aria-label="Selected day agenda">
            <div className="calendar-detail-header">
              <div>
                <span className="eyebrow">SELECTED DAY AGENDA</span>
                <h3>{selectedDay ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : "Choose a day"}</h3>
                <p className="day-subtitle">{selectedDay ? (selectedDay === todayKey ? "✦ Today's Missions" : "Scheduled quests for this date") : "Click any day on the calendar to inspect active quests"}</p>
              </div>
              {selectedDay && (
                <button
                  className="close-detail-btn"
                  onClick={() => setSelectedDay(null)}
                  aria-label="Dismiss day details"
                  title="Close details"
                >
                  ✕
                </button>
              )}
            </div>

            {selectedDayQuests.length > 0 ? (
              <div className="selected-quests-list">
                <div className="panel-summary-bar">
                  <span><b>{selectedDayQuests.length}</b> {selectedDayQuests.length === 1 ? "Quest" : "Quests"} active</span>
                  <span><b>{selectedDayQuests.reduce((acc, q) => acc + (q.xp || 0), 0)}</b> XP total</span>
                </div>
                {selectedDayQuests.map((quest) => (
                  <article className={`selected-quest-card ${quest.type.toLowerCase()}`} key={quest.id} itemScope itemType="https://schema.org/Action">
                    <div className="selected-quest-header">
                      <span className={`calendar-dot ${quest.type.toLowerCase()}`} />
                      <span className="quest-type-label">{quest.type}</span>
                      <span className={`difficulty ${quest.difficulty.toLowerCase()}`}>{quest.difficulty}</span>
                    </div>
                    <h4 itemProp="name">{quest.title}</h4>
                    {quest.description && <p>{quest.description}</p>}
                    <div className="selected-quest-meta">
                      <span>◷ Deadline: <time>{quest.due}</time></span>
                      <div className="selected-quest-rewards">
                        <span>✦ <b>{quest.xp}</b> XP</span>
                        <span>◇ <b>{quest.gold}</b> gold</span>
                      </div>
                    </div>
                    <div className="selected-quest-actions">
                      {quest.status === "completed" ? (
                        <span className="completed-label">✓ Completed today</span>
                      ) : (
                        <button className="complete-btn" onClick={() => completeQuest(quest)} disabled={busy}>
                          Complete quest
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-day-state">
                <div className="empty-day-icon">✧</div>
                <p>{selectedDay ? "No active quests scheduled on this date." : "Click any calendar day to inspect its active missions."}</p>
                {selectedDay && (
                  <button
                    className="quick-plan-btn"
                    onClick={() => {
                      setAppView("board");
                      setShowForm(true);
                      setNewQuestDue(selectedDay);
                    }}
                  >
                    ＋ Plan a quest for this day
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </section>
    );
  }

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">✦</span><span>QUESTLIFE</span></div><div className="player-card"><div className="avatar">✧</div><div><strong>{user.username}</strong><span>Level {user.level} · Wayfinder</span></div><span className="online-dot" /></div><nav className="nav-list" aria-label="Main navigation"><button className={appView === "board" ? "nav-item active" : "nav-item"} onClick={() => setAppView("board")}><span>▦</span> Quest board <b>{visibleQuests.length}</b></button><button className={appView === "calendar" ? "nav-item active" : "nav-item"} onClick={() => setAppView("calendar")}><span>◈</span> Calendar</button><button className={appView === "inventory" ? "nav-item active" : "nav-item"} onClick={() => setAppView("inventory")}><span>✥</span> Inventory</button><button className={appView === "character" ? "nav-item active" : "nav-item"} onClick={() => setAppView("character")}><span>♙</span> Character</button><button className={appView === "achievements" ? "nav-item active" : "nav-item"} onClick={() => setAppView("achievements")}><span>✹</span> Achievements</button></nav><div className="sidebar-footer"><div className="streak-icon">♨</div><div><strong>{user.streak} day streak</strong><span>Keep the flame alive</span></div></div><button className="sign-out" onClick={logout}>↪ Sign out</button></aside><section className="workspace"><header className="topbar"><div><span className="eyebrow">YOUR QUEST HALL</span><h1>{appView === "board" ? "Quest board" : appView.charAt(0).toUpperCase() + appView.slice(1)}</h1></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">♧<i /></button><button className="profile-button"><span>{user.username.slice(0, 2).toUpperCase()}</span><b>{user.username}</b><small>⌄</small></button></div></header>{appView === "board" && <section className="board-content"><section className="hero-panel"><div><span className="eyebrow gold">THE SUNLIT REALM · CHAPTER I</span><h2>Make today <em>legendary.</em></h2><p>Your next great adventure is hiding in the ordinary.</p></div><div className="hero-rune">✦</div><div className="level-panel"><div className="level-row"><span>LEVEL {user.level}</span><strong>{levelXp} <small>/ {levelTarget} XP</small></strong></div><div className="xp-track"><span style={{ width: `${Math.min(100, levelXp / levelTarget * 100)}%` }} /></div><span className="next-level">{Math.max(0, levelTarget - levelXp)} XP until next level</span></div></section><section className="stats-grid"><div className="stat-card"><span className="stat-icon coral">◒</span><div><small>QUESTS COMPLETED</small><strong>{completedCount}</strong></div></div><div className="stat-card"><span className="stat-icon gold-icon">◇</span><div><small>GOLD EARNED</small><strong>{user.gold}</strong></div></div><div className="stat-card"><span className="stat-icon mint">♨</span><div><small>CURRENT STREAK</small><strong>{user.streak} days</strong></div></div></section><div className="content-heading"><div><span className="eyebrow">YOUR ADVENTURE</span><h2>{questView === "active" ? "Active quests" : "Completed quests"} <span>{visibleQuests.length}</span></h2></div>{questView === "active" && <button className="primary-button" onClick={() => setShowForm((current) => !current)}>＋ New quest</button>}</div><div className="quest-view-tabs"><button className={questView === "active" ? "view-tab active" : "view-tab"} onClick={() => setQuestView("active")}>Active quests <b>{quests.filter((quest) => (quest.status ?? (quest.completed ? "completed" : "active")) === "active").length}</b></button><button className={questView === "completed" ? "view-tab active" : "view-tab"} onClick={() => setQuestView("completed")}>Completed <b>{completedCount}</b></button></div>{showForm && <div className="quick-add"><input autoFocus value={newQuest} onChange={(event) => setNewQuest(event.target.value)} placeholder="Name your next quest..." /><select value={newQuestType} onChange={(event) => setNewQuestType(event.target.value as QuestType)} aria-label="Quest type">{questTypes.map((type) => <option key={type} value={type}>{type} quest</option>)}</select><input className="deadline-input" type="datetime-local" value={newQuestDue} onChange={(event) => setNewQuestDue(event.target.value)} aria-label="Quest deadline" /><button onClick={addQuest} disabled={busy}>Add quest</button></div>}<div className="toolbar"><div className="filters">{filters.map((filter) => <button key={filter} className={activeFilter === filter ? "filter active" : "filter"} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</div><label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search quests" /></label></div><div className="quest-grid">{visibleQuests.map(renderQuestCard)}</div>{visibleQuests.length === 0 && <div className="empty-state">{questView === "active" ? "Your quest log is clear. Add your first mission to begin the adventure." : "No completed quests yet. Daily quests stay in the active realm because they repeat."}</div>}</section>}{appView === "calendar" && renderCalendar()}{appView === "inventory" && renderInventory()}{appView === "character" && renderCharacter()}{appView === "achievements" && renderAchievements()}</section>{toast && <div className="toast">✦ {toast}</div>}</main>;
}
