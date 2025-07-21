import { App, Plugin, Notice, Editor, Menu, MarkdownView } from "obsidian";

export default class VoiceAnnotationPlugin extends Plugin {
  async onload() {
    new Notice("Voice Annotation Plugin loaded");
    // Initialize your plugin here

    // Add an item to editor menu
    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu, editor: Editor, view: MarkdownView) => {
          const selectedText = editor.getSelection();
          if (!selectedText) return;

          menu.addItem((item) => {
            item
              .setTitle("Speak Selected Text")
              .setIcon("mic")
              .onClick(() => {
                // Get the language from the editor or view settings
                // const lang = view.getMode().getLanguage() || "en-US";
                this.speakText(selectedText, "en-US");
              });
          });
        }
      )
    );
  }

  speakText(text: string, lang: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;

    // Try to find the voice that matches the language
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find((voice) => voice.lang === lang);
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    } else {
      new Notice(`No voice found for language: ${lang}`);
    }
  }
}
