/* =====================================================================
   BLAZERS MISSION CONTEXT — Survivability Assessment Grid
   Reads mission context from the URL the Command Center passes, injects a
   mission banner, resolves the mission name, and exposes helpers so main.js
   can read mission-scoped samples and write the habitability summary back.
   Additive only. Standalone (no missionId) falls back to legacy behaviour.
   ===================================================================== */
(function () {
  const params = new URLSearchParams(window.location.search);
  const missionId = params.get("missionId");

  const mission = {
    id: missionId || null,
    lat: parseFloat(params.get("lat")) || null,
    lng: parseFloat(params.get("lng")) || null,
    radius: parseFloat(params.get("radius")) || null,
    taskType: params.get("taskType") || null,
    name: null,
    standalone: !missionId,
  };
  window.BZ_MISSION = mission;

  // Samples endpoint — mission-scoped when we have an id.
  window.BZ_samplesUrl = function () {
    return mission.id ? `/api/samples?missionId=${encodeURIComponent(mission.id)}` : "/api/samples";
  };

  function injectBanner() {
    const app = document.getElementById("app");
    if (!app || document.getElementById("bz-mission-banner")) return;
    const banner = document.createElement("div");
    banner.id = "bz-mission-banner";
    if (mission.id) {
      banner.innerHTML =
        `<span><span class="bz-k">Mission</span> <span class="bz-v" id="bz-mission-name">${mission.id}</span></span>` +
        (mission.taskType ? `<span><span class="bz-k">Task</span> <span class="bz-v">${mission.taskType}</span></span>` : "") +
        (mission.lat ? `<span><span class="bz-k">Coord</span> <span class="bz-v">${mission.lat}, ${mission.lng}</span></span>` : "") +
        (mission.radius ? `<span><span class="bz-k">Radius</span> <span class="bz-v">${mission.radius} m</span></span>` : "") +
        `<a class="bz-back" href="javascript:history.back()">← Command Center</a>`;
      // Pre-fill the coordinate form with the mission centre for convenience.
      setTimeout(() => {
        const ll = document.getElementById("location-lat");
        const lg = document.getElementById("location-long");
        if (ll && !ll.value && mission.lat) ll.value = mission.lat;
        if (lg && !lg.value && mission.lng) lg.value = mission.lng;
      }, 0);
    } else {
      banner.innerHTML = `<span class="bz-k">Standalone mode</span> <span class="bz-v">— no mission context. Launch from the Command Center to link data.</span>`;
    }
    app.insertBefore(banner, app.firstChild);
  }

  // Resolve the mission's human name from the backend and swap it into the
  // banner in place of the raw id. Sends the auth token once main.js has it;
  // retries briefly since auth may resolve slightly after this runs.
  window.BZ_resolveMissionName = async function () {
    if (!mission.id) return;
    let tries = 0;
    const attempt = async () => {
      tries++;
      // Wait for main.js to establish the auth token before calling protected
      // endpoints — avoids a transient 401 on first paint.
      if (!window.BZ_AUTH_TOKEN && tries < 12) { setTimeout(attempt, 700); return; }
      try {
        const headers = {};
        if (window.BZ_AUTH_TOKEN) headers['Auth-Token'] = window.BZ_AUTH_TOKEN;
        const res = await fetch(`/api/mission_name?missionId=${encodeURIComponent(mission.id)}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.name) {
            mission.name = data.name;
            const el = document.getElementById("bz-mission-name");
            if (el) el.textContent = data.name;
            return;
          }
        }
      } catch (e) { /* retry */ }
      if (tries < 12) setTimeout(attempt, 700);
    };
    attempt();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { injectBanner(); window.BZ_resolveMissionName(); });
  } else {
    injectBanner(); window.BZ_resolveMissionName();
  }

  console.log("[BZ] SAG mission context:", mission.standalone ? "standalone" : mission.id);
})();
