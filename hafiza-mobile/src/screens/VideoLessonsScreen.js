import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { fetchKonular, fetchDersler, fetchVideoNotes, createVideoNote, updateVideoNote, deleteVideoNote } from "../services/quiz";
import { getJSON, setJSON } from "../services/storage";
import { addActivity } from "../services/activity";
import { colors } from "../theme";

function makeVideoItems(konu) {
  const list = Array.isArray(konu?.videolar) ? konu.videolar : [];
  if (list.length > 0) {
    return list
      .map((v, idx) => ({
        id: v.id ? String(v.id) : `${konu.id}_${idx}`,
        konuId: konu.id,
        title: v.videoAdi || v.video_adi || `Video ${idx + 1}`,
        url: v.videoUrl || v.video_url || "",
      }))
      .filter((x) => !!x.url);
  }
  const url = konu?.konuAnlatimVideosuUrl || konu?.konu_anlatim_videosu_url || konu?.videoUrl || konu?.video_url;
  if (!url) return [];
  return [{ id: String(konu.id), konuId: konu.id, title: konu?.ad || "Konu Videosu", url }];
}

function formatTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function buildUrlAtTime(url, seconds) {
  try {
    const s = Math.max(0, Number(seconds) || 0);
    const raw = String(url || "");
    if (!raw) return "";
    if (raw.includes("youtube.com") || raw.includes("youtu.be")) {
      const u = new URL(raw);
      if (u.hostname.includes("youtu.be")) {
        u.searchParams.set("t", `${s}s`);
        return u.toString();
      }
      u.searchParams.set("t", String(s));
      return u.toString();
    }
    return raw;
  } catch {
    return String(url || "");
  }
}

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = String(process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  if (!base) return raw;
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function getYoutubeVideoId(url) {
  try {
    const raw = String(url || "");
    if (!raw) return null;
    if (raw.includes("youtube.com/shorts/")) {
      const m = raw.match(/shorts\/([^?&#/]+)/);
      return m?.[1] || null;
    }
    if (raw.includes("youtu.be/")) {
      const m = raw.match(/youtu\.be\/([^?&#]+)/);
      return m?.[1] || null;
    }
    if (raw.includes("youtube.com/watch")) {
      const u = new URL(raw);
      return u.searchParams.get("v");
    }
    if (raw.includes("youtube.com/embed/")) {
      const m = raw.match(/embed\/([^?&#]+)/);
      return m?.[1] || null;
    }
    if (raw.includes("youtube-nocookie.com/embed/")) {
      const m = raw.match(/embed\/([^?&#]+)/);
      return m?.[1] || null;
    }
    return null;
  } catch {
    return null;
  }
}

function makeYoutubeHtml(videoId) {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}#player{position:fixed;inset:0}</style>
  </head>
  <body>
    <div id="player"></div>
    <script src="https://www.youtube.com/iframe_api"></script>
    <script>
      let player;
      let timer = null;
      let playerState = -1;
      function post(msg){window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));}
      window.onerror = function(message, source, line, col){
        post({ type:'error', message: String(message || 'unknown'), source: String(source || ''), line: line || 0, col: col || 0 });
      };
      function clearTicker(){
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
      function startTicker(){
        clearTicker();
        timer = setInterval(function(){
          try {
            if (!player || !player.getCurrentTime) return;
            const sec = Math.floor((player.getCurrentTime() || 0));
            post({ type:'time', seconds: sec, state: playerState });
          } catch(_){}
        }, 1000);
      }
      function onYouTubeIframeAPIReady() {
        player = new YT.Player('player', {
          videoId: '${videoId}',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: function(){
              post({ type:'ready' });
              startTicker();
            },
            onStateChange: function(e){
              playerState = e && typeof e.data === 'number' ? e.data : -1;
              post({ type:'state', state: e.data });
              if (playerState === 1) startTicker(); // playing
              if (playerState === 0 || playerState === 2 || playerState === 5) clearTicker(); // ended/paused/cued
            }
          }
        });
      }
      window.__seekTo = function(sec){ try { player && player.seekTo(Number(sec)||0, true); } catch(_){} };
      window.__play = function(){ try { player && player.playVideo && player.playVideo(); } catch(_){} };
      window.__getTime = function(){ try { return Math.floor(player.getCurrentTime() || 0); } catch(_) { return 0; } };
      window.addEventListener('beforeunload', clearTicker);
    </script>
  </body>
</html>`;
}

export default function VideoLessonsScreen({ route }) {
  const [loading, setLoading] = useState(true);
  const [dersler, setDersler] = useState([]);
  const [konular, setKonular] = useState([]);
  const [selectedDersId, setSelectedDersId] = useState(null);
  const [selectedKonuId, setSelectedKonuId] = useState(null);
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [notes, setNotes] = useState([]);
  const [running, setRunning] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [noteText, setNoteText] = useState("");
  const [noteTimestamp, setNoteTimestamp] = useState(0);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [pendingSelection, setPendingSelection] = useState(null);
  const timerRef = useRef(null);
  const webViewRef = useRef(null);

  useEffect(() => {
    const dersId = route?.params?.dersId ?? null;
    const konuId = route?.params?.konuId ?? null;
    const videoId = route?.params?.videoId ?? null;
    const videoUrl = route?.params?.videoUrl ?? null;
    const noteSeconds = route?.params?.noteSeconds ?? null;
    if (dersId || konuId || videoId || videoUrl || noteSeconds != null) {
      setPendingSelection({ dersId, konuId, videoId, videoUrl, noteSeconds });
    }
  }, [route?.params?.dersId, route?.params?.konuId, route?.params?.videoId, route?.params?.videoUrl, route?.params?.noteSeconds]);

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchDersler();
        setDersler(Array.isArray(d) ? d : []);
        const desiredDersId = pendingSelection?.dersId;
        const matchedDers = (Array.isArray(d) ? d : []).find((x) => String(x.id) === String(desiredDersId));
        if (matchedDers?.id) {
          setSelectedDersId(matchedDers.id);
        } else if (d?.[0]?.id) {
          setSelectedDersId(d[0].id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [pendingSelection?.dersId]);

  useEffect(() => {
    if (!selectedDersId) return;
    (async () => {
      const konuList = await fetchKonular(selectedDersId);
      setKonular(Array.isArray(konuList) ? konuList : []);
      const desiredKonuId = pendingSelection?.konuId;
      const hasDesired = (Array.isArray(konuList) ? konuList : []).find((k) => String(k.id) === String(desiredKonuId));
      const firstKonu = (Array.isArray(konuList) ? konuList : []).find((k) => makeVideoItems(k).length > 0) || konuList?.[0] || null;
      setSelectedKonuId(hasDesired?.id || firstKonu?.id || null);
      setVideos([]);
      setSelectedVideo(null);
      const startSec = Math.max(0, Number(pendingSelection?.noteSeconds || 0));
      setCurrentSeconds(startSec);
      setNoteTimestamp(startSec);
      setRunning(false);
    })();
  }, [selectedDersId, pendingSelection?.konuId, pendingSelection?.noteSeconds]);

  useEffect(() => {
    const list = Array.isArray(konular) ? konular : [];
    const source =
      selectedKonuId != null
        ? list.filter((k) => String(k.id) === String(selectedKonuId))
        : list;
    const items = source.flatMap((k) => makeVideoItems(k));
    setVideos(items);
    const desiredVideoId = pendingSelection?.videoId;
    const desiredVideoUrl = pendingSelection?.videoUrl;
    const matchedVideo = items.find((v) => String(v.id) === String(desiredVideoId)) || items.find((v) => String(v.url) === String(desiredVideoUrl));
    setSelectedVideo(matchedVideo || items[0] || null);
    const startSec = Math.max(0, Number(pendingSelection?.noteSeconds || 0));
    setCurrentSeconds(startSec);
    setNoteTimestamp(startSec);
    setRunning(false);
    setPlayerReady(false);
    setPlayerError("");
    if (pendingSelection) {
      setPendingSelection(null);
    }
  }, [konular, selectedKonuId, pendingSelection]);

  useEffect(() => {
    if (!selectedVideo) {
      setNotes([]);
      return;
    }
    (async () => {
      try {
        const remote = await fetchVideoNotes({
          konuId: selectedVideo.konuId,
          videoId: selectedVideo.id,
          videoUrl: selectedVideo.url,
        });
        const normalized = (Array.isArray(remote) ? remote : []).map((n) => ({
          id: n.id || `r-${Date.now()}`,
          noteText: n.noteText || n.note_text || "",
          timestampSeconds: Number(n.timestampSeconds || n.timestamp_seconds || 0),
        }));
        setNotes(normalized.sort((a, b) => a.timestampSeconds - b.timestampSeconds));
      } catch {
        const key = `video_notes_${selectedVideo.konuId}_${selectedVideo.id}`;
        const local = await getJSON(key, []);
        setNotes((Array.isArray(local) ? local : []).sort((a, b) => a.timestampSeconds - b.timestampSeconds));
      }
    })();
  }, [selectedVideo]);

  useEffect(() => {
    const ytId = getYoutubeVideoId(selectedVideo?.url);
    if (!running || ytId) return;
    timerRef.current = setInterval(() => {
      setCurrentSeconds((v) => v + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running, selectedVideo]);

  const hasVideo = !!selectedVideo?.url;
  const currentTitle = useMemo(() => selectedVideo?.title || "Video secin", [selectedVideo]);
  const youtubeId = useMemo(() => getYoutubeVideoId(selectedVideo?.url), [selectedVideo]);
  const youtubeHtml = useMemo(() => (youtubeId ? makeYoutubeHtml(youtubeId) : ""), [youtubeId]);
  const youtubeSource = useMemo(() => ({ html: youtubeHtml }), [youtubeHtml]);

  async function openVideo() {
    if (!selectedVideo?.url) return;
    if (youtubeId && webViewRef.current) {
      webViewRef.current.injectJavaScript("window.__play && window.__play(); true;");
      await addActivity({
        title: "Konu videosu oynatildi",
        subtitle: currentTitle,
        type: "video",
        meta: {
          dersId: selectedDersId,
          konuId: selectedVideo.konuId,
          videoId: selectedVideo.id,
          videoUrl: selectedVideo.url,
          noteSeconds: currentSeconds,
        },
      });
      return;
    }
    try {
      await Linking.openURL(toAbsoluteUrl(selectedVideo.url));
      await addActivity({
        title: "Konu videosu acildi",
        subtitle: currentTitle,
        type: "video",
        meta: {
          dersId: selectedDersId,
          konuId: selectedVideo.konuId,
          videoId: selectedVideo.id,
          videoUrl: selectedVideo.url,
          noteSeconds: currentSeconds,
        },
      });
    } catch {
      Alert.alert("Hata", "Video URL acilamadi.");
    }
  }

  async function openYoutubeExternally() {
    if (!selectedVideo?.url) return;
    try {
      await Linking.openURL(toAbsoluteUrl(selectedVideo.url));
    } catch {
      Alert.alert("Hata", "Video dis baglantida acilamadi.");
    }
  }

  async function addNote() {
    if (!selectedVideo || !noteText.trim()) return;
    const payload = {
      konuId: selectedVideo.konuId,
      videoId: selectedVideo.id,
      videoUrl: selectedVideo.url,
      noteText: noteText.trim(),
      timestampSeconds: Number(noteTimestamp || 0),
    };
    try {
      const created = await createVideoNote(payload);
      const note = {
        id: created?.id || `n-${Date.now()}`,
        noteText: created?.noteText || payload.noteText,
        timestampSeconds: Number(created?.timestampSeconds ?? payload.timestampSeconds),
      };
      setNotes((prev) => [...prev, note].sort((a, b) => a.timestampSeconds - b.timestampSeconds));
    } catch {
      const key = `video_notes_${selectedVideo.konuId}_${selectedVideo.id}`;
      const localNote = { id: `l-${Date.now()}`, noteText: payload.noteText, timestampSeconds: payload.timestampSeconds };
      const next = [...notes, localNote].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
      await setJSON(key, next);
      setNotes(next);
    }
    await addActivity({
      title: "Video notu eklendi",
      subtitle: `${currentTitle} @ ${formatTime(noteTimestamp)}`,
      type: "note",
      meta: {
        dersId: selectedDersId,
        konuId: selectedVideo.konuId,
        videoId: selectedVideo.id,
        videoUrl: selectedVideo.url,
        noteSeconds: noteTimestamp,
      },
    });
    setNoteText("");
  }

  async function removeNote(id) {
    if (!selectedVideo) return;
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    try {
      await deleteVideoNote(id);
    } catch {
      const key = `video_notes_${selectedVideo.konuId}_${selectedVideo.id}`;
      await setJSON(key, next);
    }
  }

  function startEdit(note) {
    setEditingNoteId(note.id);
    setEditingText(note.noteText || "");
  }

  async function saveEdit() {
    if (!selectedVideo || !editingNoteId || !editingText.trim()) return;
    const nextText = editingText.trim();
    const currentNote = notes.find((n) => n.id === editingNoteId);
    if (!currentNote) {
      setEditingNoteId(null);
      setEditingText("");
      return;
    }
    try {
      const updated = await updateVideoNote(editingNoteId, { noteText: nextText });
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editingNoteId
            ? {
                ...n,
                noteText: updated?.noteText || nextText,
              }
            : n
        )
      );
    } catch {
      const key = `video_notes_${selectedVideo.konuId}_${selectedVideo.id}`;
      const next = notes.map((n) => (n.id === editingNoteId ? { ...n, noteText: nextText } : n));
      await setJSON(key, next);
      setNotes(next);
    }
    await addActivity({
      title: "Video notu duzenlendi",
      subtitle: `${currentTitle} @ ${formatTime(currentNote.timestampSeconds)}`,
      type: "note",
      meta: {
        dersId: selectedDersId,
        konuId: selectedVideo.konuId,
        videoId: selectedVideo.id,
        videoUrl: selectedVideo.url,
        noteSeconds: currentNote.timestampSeconds,
      },
    });
    setEditingNoteId(null);
    setEditingText("");
  }

  async function goToTimestamp(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    setCurrentSeconds(safe);
    setNoteTimestamp(safe);
    if (youtubeId && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.__seekTo(${safe}); true;`);
      await addActivity({
        title: "Video notundan zamana gidildi",
        subtitle: `${currentTitle} @ ${formatTime(safe)}`,
        type: "video",
        meta: {
          dersId: selectedDersId,
          konuId: selectedVideo.konuId,
          videoId: selectedVideo.id,
          videoUrl: selectedVideo.url,
          noteSeconds: safe,
        },
      });
      return;
    }
    if (!selectedVideo?.url) return;
    const targetUrl = buildUrlAtTime(toAbsoluteUrl(selectedVideo.url), safe);
    try {
      await Linking.openURL(targetUrl);
      await addActivity({
        title: "Video notundan zamana gidildi",
        subtitle: `${currentTitle} @ ${formatTime(safe)}`,
        type: "video",
        meta: {
          dersId: selectedDersId,
          konuId: selectedVideo.konuId,
          videoId: selectedVideo.id,
          videoUrl: selectedVideo.url,
          noteSeconds: safe,
        },
      });
    } catch {
      Alert.alert("Bilgi", "Zaman bilgisi ayarlandi. Video acilamadiysa linki kontrol edin.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SectionTitle title="Konu Anlatim Videolari" subtitle="Udemy gibi saniye bazli not alabilirsin" />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <Card style={styles.card}>
          <Text style={styles.h2}>Dersler</Text>
          <View style={styles.wrapRow}>
            {dersler.map((d) => (
              <PrimaryButton
                key={d.id}
                title={d.ad}
                style={[styles.smallBtn, selectedDersId === d.id && styles.activeBtn]}
                onPress={() => setSelectedDersId(d.id)}
              />
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Konular</Text>
          {konular.length === 0 ? <Text style={styles.meta}>Bu derste konu bulunamadi.</Text> : null}
          <View style={styles.wrapRow}>
            {konular.map((k) => {
              const hasVideo = makeVideoItems(k).length > 0;
              const selected = selectedKonuId === k.id;
              return (
                <View key={k.id} style={styles.topicBtnWrap}>
                  {selected ? (
                    <PrimaryButton
                      title={`✓ ${hasVideo ? k.ad : `${k.ad} (Video yok)`}`}
                      style={[styles.smallBtn, styles.selectedTopicBtn]}
                      onPress={() => setSelectedKonuId(k.id)}
                      disabled={!hasVideo}
                    />
                  ) : (
                    <SecondaryButton
                      title={hasVideo ? k.ad : `${k.ad} (Video yok)`}
                      style={[styles.smallBtn]}
                      onPress={() => setSelectedKonuId(k.id)}
                      disabled={!hasVideo}
                    />
                  )}
                </View>
              );
            })}
          </View>
          <Text style={styles.selectedTopicMeta}>
            Secili Konu: {konular.find((k) => k.id === selectedKonuId)?.ad || "-"}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Videolar</Text>
          {videos.length === 0 ? <Text style={styles.meta}>Secili konuda video bulunamadi.</Text> : null}
          <View style={styles.wrapRow}>
            {videos.map((v) => (
              <SecondaryButton
                key={v.id}
                title={v.title}
                style={[styles.smallBtn, selectedVideo?.id === v.id && styles.activeSecondary]}
                onPress={() => {
                  setSelectedVideo(v);
                  setCurrentSeconds(0);
                  setNoteTimestamp(0);
                  setRunning(false);
                }}
              />
            ))}
          </View>
          <View style={{ marginTop: 10 }}>
            <PrimaryButton title="Videoyu Ac" onPress={openVideo} disabled={!hasVideo} />
          </View>
        </Card>

        {youtubeId ? (
          <Card style={styles.card}>
            <Text style={styles.h2}>Video Oynatici (Senkron)</Text>
            <WebView
              ref={webViewRef}
              source={youtubeSource}
              style={styles.player}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              mixedContentMode="always"
              allowsFullscreenVideo
              setSupportMultipleWindows={false}
              onError={(e) => {
                setPlayerError(e?.nativeEvent?.description || "WebView oynatici hatasi.");
              }}
              onHttpError={(e) => {
                setPlayerError(`WebView HTTP hata: ${e?.nativeEvent?.statusCode || "-"}`);
              }}
              onRenderProcessGone={() => {
                setPlayerError("WebView renderer kapandi. Dis baglantidan acmayi deneyin.");
              }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data || "{}");
                  if (data?.type === "ready") {
                    setPlayerReady(true);
                    setPlayerError("");
                  }
                  if (data?.type === "time") {
                    const sec = Math.max(0, Number(data.seconds || 0));
                    setCurrentSeconds(sec);
                    setNoteTimestamp(sec);
                  }
                  if (data?.type === "error") {
                    setPlayerError(String(data?.message || "YouTube oynatici hatasi."));
                  }
                } catch {
                  // ignore malformed player messages
                }
              }}
            />
            <Text style={styles.meta}>
              YouTube senkron: {playerReady ? "Aktif" : "Hazirlaniyor..."} | Sure: {formatTime(currentSeconds)}
            </Text>
            {playerError ? <Text style={styles.errorText}>Hata: {playerError}</Text> : null}
            {!playerReady ? (
              <View style={{ marginTop: 8 }}>
                <SecondaryButton title="YouTube'u Dis Baglantida Ac" onPress={openYoutubeExternally} />
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.h2}>Konu Dokumanlari</Text>
          {konular.filter((k) => !!(k?.dokumanUrl || k?.dokuman_url)).length === 0 ? (
            <Text style={styles.meta}>Bu derste dokuman bulunamadi.</Text>
          ) : (
            konular
              .filter((k) => !!(k?.dokumanUrl || k?.dokuman_url))
              .map((k) => (
                <View key={`doc-${k.id}`} style={styles.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docTitle}>{k.dokumanAdi || k.dokuman_adi || k.ad || "Konu Dokumani"}</Text>
                    <Text style={styles.meta}>{k.ad || "-"}</Text>
                  </View>
                  <SecondaryButton
                    title="Ac"
                    onPress={async () => {
                      const url = k.dokumanUrl || k.dokuman_url;
                      if (!url) return;
                      try {
                        await Linking.openURL(toAbsoluteUrl(url));
                      } catch {
                        Alert.alert("Hata", "Dokuman acilamadi.");
                      }
                    }}
                  />
                </View>
              ))
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Video Zamani</Text>
          <Text style={styles.meta}>Konu: {currentTitle}</Text>
          <Text style={styles.timer}>{formatTime(currentSeconds)}</Text>
          <View style={styles.row}>
            <PrimaryButton
              title={running ? "Duraklat" : "Baslat"}
              style={{ flex: 1 }}
              onPress={() => setRunning((v) => !v)}
              disabled={!!youtubeId}
            />
            <SecondaryButton title="Sifirla" style={{ flex: 1 }} onPress={() => { setRunning(false); setCurrentSeconds(0); }} />
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <SecondaryButton title="Simdiki saniyeyi kullan" style={{ flex: 1 }} onPress={() => setNoteTimestamp(currentSeconds)} />
          </View>
          <View style={{ marginTop: 8 }}>
            <TextInput
              style={styles.input}
              placeholder="Not metni..."
              value={noteText}
              onChangeText={setNoteText}
            />
            <Text style={styles.meta}>Not zamani: {formatTime(noteTimestamp)}</Text>
            <PrimaryButton title="Not Ekle" onPress={addNote} disabled={!noteText.trim() || !selectedVideo} />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.h2}>Video Notlari</Text>
          {notes.length === 0 ? <Text style={styles.meta}>Henuz not yok.</Text> : null}
          {notes.map((n) => (
            <View key={n.id} style={styles.noteRow}>
              <View style={{ flex: 1 }}>
                <Pressable onPress={() => goToTimestamp(n.timestampSeconds)}>
                  <Text style={styles.noteTime}>{formatTime(n.timestampSeconds)} (Git)</Text>
                </Pressable>
                {editingNoteId === n.id ? (
                  <TextInput style={styles.input} value={editingText} onChangeText={setEditingText} placeholder="Notu duzenle..." />
                ) : (
                  <Text style={styles.noteText}>{n.noteText}</Text>
                )}
              </View>
              <View style={styles.noteActions}>
                {editingNoteId === n.id ? (
                  <>
                    <PrimaryButton title="Kaydet" onPress={saveEdit} style={styles.noteActionBtn} />
                    <SecondaryButton title="Iptal" onPress={() => { setEditingNoteId(null); setEditingText(""); }} style={styles.noteActionBtn} />
                  </>
                ) : (
                  <>
                    <SecondaryButton title="Duzenle" onPress={() => startEdit(n)} style={styles.noteActionBtn} />
                    <SecondaryButton title="Sil" onPress={() => removeNote(n.id)} style={styles.noteActionBtn} />
                  </>
                )}
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { marginBottom: 10 },
  h2: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", gap: 8 },
  smallBtn: { minWidth: 90, paddingVertical: 8 },
  activeBtn: { borderWidth: 2, borderColor: "#312e81" },
  activeSecondary: { borderWidth: 2, borderColor: "#111827" },
  topicBtnWrap: { minWidth: 110 },
  selectedTopicBtn: { borderWidth: 2, borderColor: "#312e81" },
  selectedTopicMeta: { marginTop: 8, color: colors.primary, fontWeight: "800", fontSize: 12 },
  player: { width: "100%", height: 220, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 6, fontWeight: "700" },
  timer: { fontSize: 38, color: colors.primary, fontWeight: "800", marginBottom: 8 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  noteRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  noteTime: { color: colors.primary, fontWeight: "700", marginBottom: 2 },
  noteText: { color: colors.text },
  noteActions: { gap: 6 },
  noteActionBtn: { minWidth: 82, paddingVertical: 8 },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  docTitle: { color: colors.text, fontWeight: "700" },
});
