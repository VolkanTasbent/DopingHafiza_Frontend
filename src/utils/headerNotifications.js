import api from "../services/api";

function normalizeReport(r) {
  let finishedAtDate = null;
  if (r.finishedAt) {
    finishedAtDate = new Date(r.finishedAt);
  }
  return {
    oturumId: r.oturumId,
    finishedAt: finishedAtDate,
    correctCount: r.correctCount || 0,
    wrongCount: r.wrongCount || 0,
    emptyCount: r.emptyCount || 0,
    durationMs: r.durationMs || 0,
    net: r.net || 0,
    items: r.items || [],
  };
}

/** Dashboard ile aynı kaynak: önce grafikler, yoksa düz raporlar. */
export async function fetchReportsForHeader() {
  try {
    const { data } = await api.get("/api/raporlar/grafikler", {
      params: { limit: 200 },
    });
    return (Array.isArray(data) ? data : []).map(normalizeReport);
  } catch {
    try {
      const { data } = await api.get("/api/raporlar", { params: { limit: 200 } });
      return (Array.isArray(data) ? data : []).map(normalizeReport);
    } catch {
      return [];
    }
  }
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * @param {ReturnType<typeof normalizeReport>[]} raporlar
 * @param {(page: string) => void} setPage
 */
export function buildHeaderNotifications(raporlar, setPage) {
  const list = [];
  const now = new Date();
  const todayKey = dateKey(now);

  if (!raporlar.length) {
    list.push({
      id: "no-reports",
      icon: "✨",
      title: "Hoş geldin",
      message: "İlk soru oturumunu başlattığında burada özet bildirimler göreceksin.",
      time: "",
      read: false,
      onClick: () => setPage("coz"),
    });
    return list;
  }

  let todaySolved = 0;
  let todaySessions = 0;
  for (const r of raporlar) {
    if (!r.finishedAt) continue;
    const fd = r.finishedAt instanceof Date ? r.finishedAt : new Date(r.finishedAt);
    if (Number.isNaN(fd.getTime())) continue;
    if (dateKey(fd) === todayKey) {
      todaySessions += 1;
      todaySolved += (r.correctCount || 0) + (r.wrongCount || 0) + (r.emptyCount || 0);
    }
  }

  if (todaySolved > 0) {
    list.push({
      id: "today-progress",
      icon: "🎯",
      title: "Bugünkü çalışman",
      message: `Bugün ${todaySessions} oturumda ${todaySolved} soru çözdün.`,
      time: "Bugün",
      read: false,
      onClick: () => setPage("raporlar"),
    });
  } else {
    list.push({
      id: "nudge-today",
      icon: "📘",
      title: "Bugün henüz soru çözmedin",
      message: "Kısa bir oturum bile motivasyonu artırır. Hadi başlayalım!",
      time: "Şimdi",
      read: false,
      onClick: () => setPage("coz"),
    });
  }

  const withDates = raporlar
    .filter((r) => r.finishedAt)
    .map((r) => {
      const fd = r.finishedAt instanceof Date ? r.finishedAt : new Date(r.finishedAt);
      return { ...r, _t: fd.getTime() };
    })
    .filter((r) => !Number.isNaN(r._t))
    .sort((a, b) => b._t - a._t);

  if (withDates.length > 0) {
    const last = withDates[0];
    const lastDate = last.finishedAt instanceof Date ? last.finishedAt : new Date(last.finishedAt);
    const diffMs = now.getTime() - lastDate.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    const timeStr =
      diffH < 1 ? "Az önce" : diffH < 24 ? `${diffH} saat önce` : `${Math.floor(diffH / 24)} gün önce`;
    const total = (last.correctCount || 0) + (last.wrongCount || 0) + (last.emptyCount || 0);
    list.push({
      id: "last-session",
      icon: "📊",
      title: "Son oturumun",
      message:
        total > 0
          ? `Son çalışmanda ${last.correctCount || 0} doğru, ${last.wrongCount || 0} yanlış (${total} soru).`
          : "Son raporlarına göz atmak için tıkla.",
      time: timeStr,
      read: false,
      onClick: () => setPage("raporlar"),
    });
  }

  return list.slice(0, 6);
}
