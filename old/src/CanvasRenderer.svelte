<script>
  import { createEventDispatcher, onMount } from "svelte";

  export let skin;
  export let scale;
  export let baseUrl;
  export let skinName;
  export let activeTab;

  const dispatch = createEventDispatcher();

  let canvas;
  let ctx;
  let images = {};

  $: if (canvas) {
    canvas.width = skin.root.width * scale;
    canvas.height = skin.root.height * scale;
    ctx = canvas.getContext("2d");
    renderSkin();
  }

  onMount(() => {
    loadImages().then(renderSkin);
  });

  async function loadImages() {
    const imagesToLoad = new Set();

    function findImages(element) {
      if (element.image && element.image.texture) {
        imagesToLoad.add(element.image.texture);
      }
      if (element.button && element.button.texture) {
        imagesToLoad.add(element.button.texture);
      }
      if (element.spritesheet && element.spritesheet.texture) {
        imagesToLoad.add(element.spritesheet.texture);
      }
      if (element.children) {
        element.children.forEach(findImages);
      }
    }

    findImages(skin);

    const imagePromises = Array.from(imagesToLoad).map((textureName) =>
      loadImage(`${baseUrl}/${skinName}/${textureName}.png`, textureName),
    );

    await Promise.all(imagePromises);
    console.log("All images loaded:", images);
  }

  function loadImage(src, name) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        images[name] = img;
        console.log(`Image loaded: ${name}`);
        resolve();
      };
      img.onerror = (e) => {
        console.error(`Error loading image ${name}:`, e);
        reject(e);
      };
      img.src = src;
    });
  }

  function renderSkin() {
    if (!ctx) return;
    console.log("Rendering skin");
    ctx.fillStyle = "lightgray"; // Add a background color for visibility
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    skin.children.forEach((element) => renderElement(element));
  }

  function renderElement(element, parentX = 0, parentY = 0) {
    // let x = (parentX + element.x) * scale;
    // let y = (parentY + element.y) * scale;
    // let width = element.width * scale;
    // let height = element.height * scale;

    console.log(`Rendering element: ${element.name}`);

    if (element.image) {
      const img = images[element.image.texture];
      if (img) {
        console.log(`Drawing image: ${element.image.texture}`);
        ctx.drawImage(
          img,
          (parentX + element.image.x) * scale,
          (parentY + element.image.y) * scale,
          element.image.width * scale,
          element.image.height * scale,
        );
      } else {
        console.warn(`Image not found: ${element.image.texture}`);
      }
    } else if (element.label) {
      renderLabel(
        element,
        (parentX + element.label.x) * scale,
        (parentY + element.label.y) * scale,
        element.label.width * scale,
        element.label.height * scale,
      );
    } else if (element.button) {
      renderButton(
        element,
        (parentX + element.button.x) * scale,
        (parentY + element.button.y) * scale,
        element.button.width * scale,
        element.button.height * scale,
      );
    } else if (element.rotary) {
      renderRotary(
        element,
        (parentX + element.rotary.x) * scale,
        (parentY + element.rotary.y) * scale,
        element.rotary.width * scale,
        element.rotary.height * scale,
      );
    } else if (element.combobox) {
      renderCombobox(
        element,
        (parentX + element.combobox.x) * scale,
        (parentY + element.combobox.y) * scale,
        element.combobox.width * scale,
        element.combobox.height * scale,
      );
    } else if (element.container) {
      ctx.fillStyle = `blue`;
      ctx.fillRect(element.container.x, element.container.y, element.container.width, element.container.height);
    }

    // TODO: implement
    // element.children.forEach((child) => renderElement(child, x / scale, y / scale));
  }

  function renderLabel(element, x, y, width, height) {
    ctx.font = `${element.label.textHeight * scale}px ${element.label.fontFile || "sans-serif"}`;
    ctx.fillStyle = element.label.color || "#000000";
    ctx.textBaseline = "middle";

    let textX = x;
    const textY = y + height / 2;

    if (element.label.alignH === "R") {
      ctx.textAlign = "right";
      textX += width;
    } else if (element.label.alignH === "C") {
      ctx.textAlign = "center";
      textX += width / 2;
    } else {
      ctx.textAlign = "left";
    }

    if (element.label.backgroundColor) {
      ctx.fillStyle = `#${element.label.backgroundColor.slice(0, 6)}`;
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = element.label.color || "#000000";
    }

    ctx.fillText(element.label.text || "", textX, textY);
  }

  function renderButton(element, x, y, width, height) {
    const img = images[element.button.texture];
    if (img) {
      const isActive = activeTab === element.name.replace("Tab", "page_").toLowerCase();
      const srcY = isActive ? 0 : img.height / 2;
      ctx.save();
      ctx.drawImage(img, 0, srcY, img.width, img.height / 2, x, y, width, height);
      ctx.strokeStyle = "yellow";
      ctx.strokeRect(x, y, width, height);
      ctx.restore();
    } else {
      console.warn(`Button image not found: ${element.button.texture}`);
    }
  }

  function renderRotary(element, x, y, width, height) {
    ctx.strokeStyle = "blue";
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "black";
    ctx.font = "12px sans-serif";
    ctx.fillText("Rotary", x + 5, y + height / 2);
  }

  function renderCombobox(element, x, y, width, height) {
    ctx.strokeStyle = "green";
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "black";
    ctx.font = "12px sans-serif";
  }

  function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / scale;
    const clickY = (event.clientY - rect.top) / scale;

    skin.children.forEach((element) => {
      if (element.name.startsWith("Tab") && isClickInside(clickX, clickY, element)) {
        alert("clicked");
        dispatch("tabClick", element.name);
      }
    });
  }

  function isClickInside(x, y, element) {
    return x >= element.x && x <= element.x + element.width && y >= element.y && y <= element.y + element.height;
  }
</script>

<canvas bind:this={canvas} on:click={handleCanvasClick} class="border border-gray-300"></canvas>
