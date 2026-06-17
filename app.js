(function () {
  const config = window.AR_POETRY_CONFIG;

  const intro = document.getElementById("intro");
  const startButton = document.getElementById("start-button");
  const demoButton = document.getElementById("demo-button");
  const hud = document.getElementById("hud");
  const message = document.getElementById("message");
  const distanceLabel = document.getElementById("distance");
  const placeTitle = document.getElementById("place-title");
  const statusLabel = document.getElementById("status");
  const scene = document.getElementById("scene");

  let points = [];
  let pointConfigs = config.points.map((point) => ({ ...point }));
  let activePointId = null;
  let watchId = null;
  let isDemoMode = false;
  const audioByPointId = new Map();

  AFRAME.registerComponent("face-camera", {
    init: function () {
      this.cameraElement = document.getElementById("camera");
      this.cameraPosition = new THREE.Vector3();
      this.entityPosition = new THREE.Vector3();
      this.lastUpdate = 0;
    },

    tick: function () {
      if (!this.cameraElement) return;

      const now = performance.now();
      if (now - this.lastUpdate < 80) return;

      this.cameraElement.object3D.getWorldPosition(this.cameraPosition);
      this.el.object3D.getWorldPosition(this.entityPosition);
      this.cameraPosition.y = this.entityPosition.y;
      this.el.object3D.lookAt(this.cameraPosition);
      this.el.object3D.rotation.x = 0;
      this.el.object3D.rotation.z = 0;
      this.lastUpdate = now;
    },
  });

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
    window.setTimeout(() => {
      message.hidden = true;
    }, 5000);
  }

  function buildPointEntities() {
    points = pointConfigs.map((point, index) => {
      const entity = document.createElement("a-entity");
      entity.classList.add("ar-point");
      entity.setAttribute("gps-new-entity-place", gpsAttribute(point));
      entity.setAttribute("face-camera", "");

      const card = document.createElement("a-entity");
      card.setAttribute(
        "animation__float",
        [
          "property: position",
          "from: 0 0 0",
          "to: 0 0.7 0",
          "dir: alternate",
          "dur: 1800",
          "easing: easeInOutSine",
          "loop: true",
        ].join("; ")
      );

      const shadow = document.createElement("a-plane");
      shadow.setAttribute("width", getFrameWidth());
      shadow.setAttribute("height", getFrameHeight());
      shadow.setAttribute("position", `0 ${config.imageAltitude - 0.16} -0.28`);
      shadow.setAttribute(
        "material",
        "color: #000000; opacity: 0.32; transparent: true; shader: flat; depthTest: false"
      );

      const frame = document.createElement("a-plane");
      frame.setAttribute("width", getFrameWidth());
      frame.setAttribute("height", getFrameHeight());
      frame.setAttribute("position", `0 ${config.imageAltitude} -0.16`);
      frame.setAttribute("material", "color: #f3b544; shader: flat; depthTest: false");

      const image = document.createElement("a-image");
      image.setAttribute("src", point.image);
      image.setAttribute("width", getImageWidth());
      image.setAttribute("height", getImageHeight());
      image.setAttribute("position", `0 ${config.imageAltitude} 0`);
      image.setAttribute("material", "shader: flat; depthTest: false");

      const labelBackground = document.createElement("a-plane");
      labelBackground.setAttribute("width", getLabelWidth());
      labelBackground.setAttribute("height", getLabelHeight());
      labelBackground.setAttribute("position", `0 ${getLabelY()} 0.12`);
      labelBackground.setAttribute(
        "material",
        "color: #101113; opacity: 0.82; transparent: true; shader: flat; depthTest: false"
      );

      const label = document.createElement("a-text");
      label.setAttribute("value", point.title);
      label.setAttribute("align", "center");
      label.setAttribute("color", "#f7f4ee");
      label.setAttribute("width", "36");
      label.setAttribute("position", `0 ${getLabelY()} 0.2`);
      label.setAttribute("material", "shader: flat; depthTest: false");

      const audioIcon = document.createElement("a-image");
      audioIcon.classList.add("clickable");
      audioIcon.setAttribute("src", config.audioIconOff);
      audioIcon.setAttribute("width", getAudioIconSize());
      audioIcon.setAttribute("height", getAudioIconSize());
      audioIcon.setAttribute("position", `${getAudioIconX()} ${getAudioIconY()} 0.28`);
      audioIcon.setAttribute("material", "shader: flat; transparent: true; depthTest: false");

      const audio = getPointAudio(index, point.audio);
      audio.addEventListener("ended", () => {
        if (activePointId !== index) return;
        activePointId = null;
        updateAudioIcons();
        statusLabel.textContent = "Toque no ícone do áudio";
      });

      audioIcon.addEventListener("click", () => togglePointAudio(index));

      card.appendChild(shadow);
      card.appendChild(frame);
      card.appendChild(image);
      card.appendChild(labelBackground);
      card.appendChild(label);
      card.appendChild(audioIcon);
      entity.appendChild(card);
      scene.appendChild(entity);

      return {
        ...point,
        id: index,
        audio,
        distance: Number.POSITIVE_INFINITY,
        entity,
        audioIcon,
      };
    });
  }

  function gpsAttribute(point) {
    return `latitude: ${point.latitude}; longitude: ${point.longitude}`;
  }

  function getImageWidth() {
    return isDemoMode ? config.demoImageWidth : config.imageWidth;
  }

  function getImageHeight() {
    return isDemoMode ? config.demoImageHeight : config.imageHeight;
  }

  function getFrameWidth() {
    return getImageWidth() + getFramePadding();
  }

  function getFrameHeight() {
    return getImageHeight() + getFramePadding();
  }

  function getFramePadding() {
    return isDemoMode ? 0.28 : 0.55;
  }

  function getLabelY() {
    const gap = isDemoMode ? 0.7 : 1.1;
    return config.imageAltitude - getImageHeight() / 2 - gap;
  }

  function getLabelWidth() {
    return Math.max(getImageWidth() * 0.92, isDemoMode ? 4.8 : 8.5);
  }

  function getLabelHeight() {
    return isDemoMode ? 0.85 : 1.2;
  }

  function getAudioIconX() {
    return getImageWidth() / 2 - getAudioIconSize() * 0.18;
  }

  function getAudioIconY() {
    return config.imageAltitude - getImageHeight() / 2 + getAudioIconSize() * 0.18;
  }

  function getAudioIconSize() {
    return isDemoMode ? 1.35 : 2.45;
  }

  function getPointAudio(pointId, source) {
    if (!audioByPointId.has(pointId)) {
      const audio = new Audio(source);
      audio.loop = false;
      audio.preload = "auto";
      audioByPointId.set(pointId, audio);
    }

    return audioByPointId.get(pointId);
  }

  function primeConfiguredAudio() {
    config.points.forEach((point, index) => {
      const audio = getPointAudio(index, point.audio);
      primeAudioElement(audio);
    });
  }

  function primeAudio() {
    points.forEach((point) => {
      primeAudioElement(point.audio);
    });
  }

  function primeAudioElement(audio) {
    audio.muted = true;
    const promise = audio.play();

    if (!promise) return;

    promise
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  }

  function startGpsWatch() {
    if (!navigator.geolocation) {
      showMessage("Este navegador não tem suporte a GPS.");
      return;
    }

    if (watchId !== null) return;

    watchId = navigator.geolocation.watchPosition(
      handlePosition,
      () => {
        distanceLabel.textContent = "Não foi possível ler o GPS";
        statusLabel.textContent = "Verifique a localização";
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      }
    );
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("GPS indisponível."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      });
    });
  }

  function applyDemoCoordinates(position) {
    const demoOffsets = [
      { distance: 8, bearing: 0 },
      { distance: 12, bearing: 120 },
      { distance: 16, bearing: 240 },
    ];

    pointConfigs = config.points.map((point, index) => {
      const offset = demoOffsets[index] || demoOffsets[0];
      const coordinates = destinationPoint(
        position.coords.latitude,
        position.coords.longitude,
        offset.distance,
        offset.bearing
      );

      return {
        ...point,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      };
    });
  }

  function handlePosition(position) {
    const userLatitude = position.coords.latitude;
    const userLongitude = position.coords.longitude;

    points.forEach((point) => {
      point.distance = distanceInMeters(
        userLatitude,
        userLongitude,
        point.latitude,
        point.longitude
      );
    });

    updateNearestPoint();
  }

  function updateNearestPoint() {
    const nearest = getNearestPoint();
    if (!nearest || !Number.isFinite(nearest.distance)) return;

    placeTitle.textContent = nearest.title;
    distanceLabel.textContent = `${Math.round(nearest.distance)} m do ponto mais próximo`;
    if (activePointId === null) statusLabel.textContent = "Toque no ícone do áudio";
  }

  function getNearestPoint() {
    return points.reduce((nearest, point) => {
      if (!nearest || point.distance < nearest.distance) return point;
      return nearest;
    }, null);
  }

  function togglePointAudio(pointId) {
    const point = points.find((item) => item.id === pointId);
    if (!point) return;

    if (activePointId === pointId && !point.audio.paused) {
      stopActiveAudio();
      statusLabel.textContent = "Áudio desligado";
      return;
    }

    playPointAudio(pointId);
  }

  function playPointAudio(pointId) {
    const point = points.find((item) => item.id === pointId);
    if (!point) return;

    if (activePointId !== pointId) stopActiveAudio();

    activePointId = pointId;

    if (!point.audio.paused) return;

    point.audio.currentTime = 0;
    placeTitle.textContent = point.title;
    statusLabel.textContent = "Áudio tocando";
    updateAudioIcons();
    point.audio.play().catch(() => {
      activePointId = null;
      updateAudioIcons();
      showMessage("Toque no ícone do áudio novamente para liberar o som neste navegador.");
    });
  }

  function stopActiveAudio() {
    const activePoint = points.find((point) => point.id === activePointId);
    if (!activePoint) {
      activePointId = null;
      return;
    }

    activePoint.audio.pause();
    activePoint.audio.currentTime = 0;
    activePointId = null;
    updateAudioIcons();
  }

  function updateAudioIcons() {
    points.forEach((point) => {
      point.audioIcon.setAttribute(
        "src",
        activePointId === point.id ? config.audioIconOn : config.audioIconOff
      );
    });
  }

  function distanceInMeters(latA, lonA, latB, lonB) {
    const earthRadius = 6371000;
    const deltaLatitude = toRadians(latB - latA);
    const deltaLongitude = toRadians(lonB - lonA);
    const startLatitude = toRadians(latA);
    const endLatitude = toRadians(latB);

    const haversine =
      Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
      Math.cos(startLatitude) *
        Math.cos(endLatitude) *
        Math.sin(deltaLongitude / 2) *
        Math.sin(deltaLongitude / 2);

    return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  function destinationPoint(latitude, longitude, distance, bearingDegrees) {
    const earthRadius = 6371000;
    const angularDistance = distance / earthRadius;
    const bearing = toRadians(bearingDegrees);
    const startLatitude = toRadians(latitude);
    const startLongitude = toRadians(longitude);

    const endLatitude = Math.asin(
      Math.sin(startLatitude) * Math.cos(angularDistance) +
        Math.cos(startLatitude) * Math.sin(angularDistance) * Math.cos(bearing)
    );

    const endLongitude =
      startLongitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(startLatitude),
        Math.cos(angularDistance) - Math.sin(startLatitude) * Math.sin(endLatitude)
      );

    return {
      latitude: toDegrees(endLatitude),
      longitude: toDegrees(endLongitude),
    };
  }

  function toRadians(value) {
    return (value * Math.PI) / 180;
  }

  function toDegrees(value) {
    return (value * 180) / Math.PI;
  }

  async function requestMotionPermission() {
    const orientation = window.DeviceOrientationEvent;
    if (!orientation || typeof orientation.requestPermission !== "function") {
      return;
    }

    const permission = await orientation.requestPermission();
    if (permission !== "granted") {
      throw new Error("Permissão dos sensores negada.");
    }
  }

  async function startExperience(options = {}) {
    try {
      isDemoMode = Boolean(options.demo);
      primeConfiguredAudio();
      await requestMotionPermission();
      if (options.demo) {
        statusLabel.textContent = "Obtendo GPS para demonstração";
        const position = await getCurrentPosition();
        applyDemoCoordinates(position);
      }

      intro.hidden = true;
      hud.hidden = false;
      placeTitle.textContent = config.title;
      statusLabel.textContent = options.demo ? "Modo demonstração ativo" : "Aguardando GPS";
      if (!points.length) buildPointEntities();
      primeAudio();
      startGpsWatch();
      if (options.demo) {
        showMessage("Modo demonstração ativo: pontos criados a poucos metros de você.");
      }
    } catch (error) {
      showMessage(
        "Não foi possível iniciar. Verifique as permissões de câmera, GPS e sensores."
      );
    }
  }

  startButton.addEventListener("click", () => startExperience());
  demoButton.addEventListener("click", () => startExperience({ demo: true }));

  window.addEventListener("arjs-nft-loaded", () => {
    showMessage("AR.js carregado.");
  });
})();
