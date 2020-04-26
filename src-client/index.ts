const form = document.querySelector("form");
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const textInputEl = form.querySelector("[name=text]") as HTMLInputElement;
  const response = await fetch("/io/web", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-accept": "audio",
    },
    body: JSON.stringify({
      text: textInputEl.value,
    }),
  });

  const blob = new Blob([(await response.body.getReader().read()).value], { type: "audio/mp3" });
  const url = window.URL.createObjectURL(blob);

  const audio = new Audio();
  audio.src = url;
  audio.play();
});
