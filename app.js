(function () {
  const config = window.AR_POETRY_CONFIG;
  const params = new URLSearchParams(window.location.search);
  const latitude = Number(params.get("lat")) || config.latitude;
  const longitude = Number(params.get("lon")) || config.longitude;

  const intro = document.getElementById("intro");
  const startButton = document.getElementById("start-button");
  const hud = document.getElementById("hud");
  const message = document.getElementById("message");
  const distanceLabel = document.getElementById("distance");
  const placeTitle = document.getElementById("place-title");
  const statusLabel = document.getElementById("status");
  const scene = document.getElementById("scene");
  const poemModal = document.getElementById("poem-modal");
  const closeModal = document.getElementById("close-modal");

  let cubeEntity;

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
    window.setTimeout(() => {
      message.hidden = true;
    }, 5000);
  }

  function buildCubeEntity() {
    cubeEntity = document.createElement("a-box");
    cubeEntity.classList.add("clickable");
    cubeEntity.setAttribute("color", "#ff1f1f");
    cubeEntity.setAttribute("depth", config.cubeSize);
    cubeEntity.setAttribute("height", config.cubeSize);
    cubeEntity.setAttribute("width", config.cubeSize);
    cubeEntity.setAttribute("position", `0 ${config.cubeAltitude} 0`);
    cubeEntity.setAttribute(
      "gps-new-entity-place",
      `latitude: ${latitude}; longitude: ${longitude}`
    );
    scene.appendChild(cubeEntity);

    cubeEntity.addEventListener("gps-entity-place-update-positon", updateDistance);
    cubeEntity.addEventListener("gps-entity-place-update-position", updateDistance);
    cubeEntity.addEventListener("click", openPoemModal);
    cubeEntity.addEventListener("mouseenter", () => {
      cubeEntity.setAttribute("color", "#ff5a3d");
    });
    cubeEntity.addEventListener("mouseleave", () => {
      cubeEntity.setAttribute("color", "#ff1f1f");
    });
  }

  function openPoemModal() {
    if (typeof poemModal.showModal === "function") {
      poemModal.showModal();
      return;
    }

    poemModal.setAttribute("open", "");
  }

  function closePoemModal() {
    if (typeof poemModal.close === "function") {
      poemModal.close();
      return;
    }

    poemModal.removeAttribute("open");
  }

  function updateDistance(event) {
    const distance =
      event.detail?.distance ||
      cubeEntity?.components?.["gps-new-entity-place"]?.distance;

    if (!Number.isFinite(distance)) return;

    distanceLabel.textContent = `${Math.round(distance)} m da estatua`;
    statusLabel.textContent = "Ponto AR localizado";
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

  async function startExperience() {
    try {
      await requestMotionPermission();
      intro.hidden = true;
      hud.hidden = false;
      placeTitle.textContent = config.title;
      statusLabel.textContent = "Aguardando GPS";
      if (!cubeEntity) buildCubeEntity();
    } catch (error) {
      showMessage(
        "Nao foi possivel iniciar. Verifique as permissoes de camera, GPS e sensores."
      );
    }
  }

  startButton.addEventListener("click", startExperience);
  closeModal.addEventListener("click", closePoemModal);
  poemModal.addEventListener("click", (event) => {
    if (event.target === poemModal) closePoemModal();
  });

  window.addEventListener("arjs-nft-loaded", () => {
    showMessage("AR.js carregado.");
  });
})();
