// Decode browser recordings and send documented PCM WAV, never rename WebM as WAV.
export async function toWav(blob: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    if (audio.duration > 26)
      throw new Error("Please keep recordings under 25 seconds.");
    const offline = new OfflineAudioContext(
      1,
      Math.ceil(audio.duration * 16000),
      16000,
    );
    const source = offline.createBufferSource();
    source.buffer = audio;
    source.connect(offline.destination);
    source.start();
    const pcm = (await offline.startRendering()).getChannelData(0);
    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);
    const write = (at: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
    };
    write(0, "RIFF");
    view.setUint32(4, 36 + pcm.length * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, pcm.length * 2, true);
    pcm.forEach((v, i) =>
      view.setInt16(
        44 + i * 2,
        Math.max(-1, Math.min(1, v)) * (v < 0 ? 32768 : 32767),
        true,
      ),
    );
    return new Blob([buffer], { type: "audio/wav" });
  } finally {
    await context.close();
  }
}
