(function () {
  const config = window.AR_POETRY_CONFIG;

  const intro = document.getElementById("intro");
  const startButton = document.getElementById("start-button");
  const debugButton = document.getElementById("debug-button");
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
  let cameraLoopId = null;
  const audioByPointId = new Map();

  AFRAME.registerComponent("face-camera", {
    tick: function () {
      const camera = document.querySelector("[camera]");
      if (!camera) return;

      const cameraPosition = new THREE.Vector3();
      camera.object3D.getWorldPosition(cameraPosition);
      this.el.object3D.lookAt(cameraPosition);
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

      const image = document.createElement("a-image");
      image.classList.add("clickable");
      image.setAttribute("src", point.image);
      image.setAttribute("width", config.imageWidth);
      image.setAttribute("height", config.imageHeight);
      image.setAttribute("position", `0 ${config.imageAltitude} 0`);
      image.setAttribute("material", "shader: flat; transparent: true");
      image.setAttribute(
        "animation__float",
        [
          "property: position",
          `from: 0 ${config.imageAltitude} 0`,
          `to: 0 ${config.imageAltitude + 1.2} 0`,
          "dir: alternate",
          "dur: 1800",
          "easing: easeInOutSine",
          "loop: true",
        ].join("; ")
      );

      const label = document.createElement("a-text");
      label.setAttribute("value", point.title);
      label.setAttribute("align", "center");
      label.setAttribute("color", "#f7f4ee");
      label.setAttribute("width", "36");
      label.setAttribute("position", `0 ${config.imageAltitude - 7.3} 0.05`);
      label.setAttribute("material", "shader: flat");

      const audio = getPointAudio(index, point.audio);

      image.addEventListener("click", () => playPointAudio(index));

      entity.appendChild(image);
      entity.appendChild(label);
      scene.appendChild(entity);

      return {
        ...point,
        id: index,
        audio,
        distance: Number.POSITIVE_INFINITY,
        entity,
        imageEntity: image,
        hasPlayedInView: false,
      };
    });
  }

  function gpsAttribute(point) {
    return `latitude: ${point.latitude}; longitude: ${point.longitude}`;
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
      showMessage("Este navegador nao tem suporte a GPS.");
      return;
    }

    if (watchId !== null) return;

    watchId = navigator.geolocation.watchPosition(
      handlePosition,
      () => {
        distanceLabel.textContent = "Nao foi possivel ler o GPS";
        statusLabel.textContent = "Verifique a localizacao";
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
        reject(new Error("GPS indisponivel."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      });
    });
  }

  function applyDebugCoordinates(position) {
    const debugOffsets = [
      { distance: 8, bearing: 0 },
      { distance: 12, bearing: 120 },
      { distance: 16, bearing: 240 },
    ];

    pointConfigs = config.points.map((point, index) => {
      const offset = debugOffsets[index] || debugOffsets[0];
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
    distanceLabel.textContent = `${Math.round(nearest.distance)} m do ponto mais proximo`;
    if (activePointId === null) statusLabel.textContent = "Aponte para a imagem";
  }

  function startCameraViewLoop() {
    if (cameraLoopId !== null) return;

    const tick = () => {
      updateAudioByCameraView();
      cameraLoopId = window.requestAnimationFrame(tick);
    };

    cameraLoopId = window.requestAnimationFrame(tick);
  }

  function updateAudioByCameraView() {
    const visiblePoint = getVisiblePoint();
    if (!visiblePoint) {
      stopActiveAudio();
      points.forEach((point) => {
        point.hasPlayedInView = false;
      });
      return;
    }

    placeTitle.textContent = visiblePoint.title;
    statusLabel.textContent = "Imagem na camera";

    if (visiblePoint.hasPlayedInView && visiblePoint.audio.paused) return;

    playPointAudio(visiblePoint.id);
  }

  function getVisiblePoint() {
    const visiblePoints = points.filter(isPointInCameraView);
    if (!visiblePoints.length) return null;

    return visiblePoints.reduce((nearest, point) => {
      if (point.distance < nearest.distance) return point;
      return nearest;
    });
  }

  function isPointInCameraView(point) {
    const cameraElement = document.getElementById("camera");
    const camera = cameraElement?.components?.camera?.camera;
    if (!camera || !point.imageEntity.object3D.visible) return false;

    const position = new THREE.Vector3();
    point.imageEntity.object3D.getWorldPosition(position);

    if (position.lengthSq() === 0) return false;

    position.project(camera);

    return (
      position.z >= -1 &&
      position.z <= 1 &&
      position.x >= -0.85 &&
      position.x <= 0.85 &&
      position.y >= -0.85 &&
      position.y <= 0.85
    );
  }

  function getNearestPoint() {
    return points.reduce((nearest, point) => {
      if (!nearest || point.distance < nearest.distance) return point;
      return nearest;
    }, null);
  }

  function playPointAudio(pointId) {
    const point = points.find((item) => item.id === pointId);
    if (!point) return;

    if (activePointId !== pointId) stopActiveAudio();

    activePointId = pointId;

    if (!point.audio.paused) return;

    point.audio.currentTime = 0;
    point.hasPlayedInView = true;
    point.audio.play().catch(() => {
      point.hasPlayedInView = false;
      showMessage("Toque na imagem para liberar o audio neste navegador.");
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
      throw new Error("Permissao dos sensores negada.");
    }
  }

  async function startExperience(options = {}) {
    try {
      primeConfiguredAudio();
      await requestMotionPermission();
      if (options.debug) {
        statusLabel.textContent = "Obtendo GPS para debug";
        const position = await getCurrentPosition();
        applyDebugCoordinates(position);
      }

      intro.hidden = true;
      hud.hidden = false;
      placeTitle.textContent = config.title;
      statusLabel.textContent = options.debug ? "Debug ativo" : "Aguardando GPS";
      if (!points.length) buildPointEntities();
      primeAudio();
      startGpsWatch();
      startCameraViewLoop();
      if (options.debug) {
        showMessage("Debug ativo: pontos criados a poucos metros de voce.");
      }
    } catch (error) {
      showMessage(
        "Nao foi possivel iniciar. Verifique as permissoes de camera, GPS e sensores."
      );
    }
  }

  startButton.addEventListener("click", () => startExperience());
  debugButton.addEventListener("click", () => startExperience({ debug: true }));

  window.addEventListener("arjs-nft-loaded", () => {
    showMessage("AR.js carregado.");
  });
})();
