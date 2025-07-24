import {
  App,
  Plugin,
  Notice,
  Editor,
  Menu,
  MarkdownView,
  PluginSettingTab,
  Setting,
} from "obsidian";

interface ChattySettings {
  defaultLanguage: SpeechSynthesisVoice["lang"];
  selectedVoice: SpeechSynthesisVoice["name"];
}

const DEFAULT_SETTINGS: ChattySettings = {
  defaultLanguage: navigator.language || "",
  selectedVoice:
    window.speechSynthesis.getVoices().find((voice) => voice.default)?.name ||
    "",
};

export default class ChattyPlugin extends Plugin {
  settings: ChattySettings;

  async onload() {
    await this.loadSettings();
    new Notice("Voice Annotation Plugin loaded");

    // Add settings tab
    this.addSettingTab(new ChattySettingTab(this.app, this));

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
              .setIcon("speaker")
              .onClick(() => {
                this.speakText(
                  selectedText,
                  this.settings.defaultLanguage,
                  this.settings.selectedVoice
                );
              });
          });
        }
      )
    );
  }

  onunload() {
    // Cancel any ongoing speech synthesis
    window.speechSynthesis.cancel();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis.getVoices();
  }

  getAvailableLanguages(): string[] {
    const voices = this.getAvailableVoices();
    const languages = voices.map((voice) => voice.lang);
    const uniqueLanguages = [...new Set(languages)].sort();
    return uniqueLanguages;
  }

  speakText(
    text: string,
    lang: SpeechSynthesisVoice["lang"],
    voice: SpeechSynthesisVoice["name"]
  ) {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.lang = lang;

    if (voice) {
      let matchingVoice =
        voices.find((v) => v.name === voice) ||
        voices.find((v) => v.lang === lang);
      if (matchingVoice) {
        utterance.voice = matchingVoice;
        window.speechSynthesis.speak(utterance);
      } else {
        new Notice(
          `No voice ${voice} found for language: ${lang}, or no language has been specified.`
        );
      }
    }
  }
}

class ChattySettingTab extends PluginSettingTab {
  plugin: ChattyPlugin;

  constructor(app: App, plugin: ChattyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h1", { text: "Voice Annotation Settings" });

    // Creates/Updates the relevant settings UI and functionality
    const updateSettings = () => {
      containerEl.querySelector("#loading-msg")?.remove();
      containerEl.querySelector("#container")?.remove();

      // Create the settings sections
      const mainContainer = containerEl.createDiv({
        cls: "container",
        attr: { id: "container" },
      });
      const infoContainer = mainContainer.createDiv({
        cls: "info-container",
        attr: { id: "info-container" },
      });
      const settingsContainer = mainContainer.createDiv({
        cls: "settings-container",
        attr: { id: "settings-container" },
      });
      const testContainer = mainContainer.createDiv({
        cls: "test-container",
        attr: { id: "test-container" },
      });

      // Voice & Language info
      const voices = this.plugin.getAvailableVoices();
      const languages = this.plugin.getAvailableLanguages();
      if (voices.length > 0) {
        const infoEl = infoContainer.createDiv({
          cls: "voice-info",
          attr: { id: "voice-info" },
        });
        infoEl.createEl("p", {
          text: `Total voices available: ${voices.length}`,
        });
        infoEl.createEl("p", {
          text: `Languages supported: ${languages.length}`,
        });
      }

      // Language selection settings
      const langContainer = settingsContainer.createDiv({
        cls: "language-setting",
        attr: { id: "language-setting" },
      });
      new Setting(langContainer)
        .setName("Default Language")
        .setDesc("Choose the default language for text-to-speech")
        .addDropdown((dropdown) => {
          languages.forEach((lang) => {
            dropdown.addOption(lang, lang);
          });
          dropdown.setValue(this.plugin.settings.defaultLanguage);
          dropdown.onChange(async (value) => {
            this.plugin.settings.defaultLanguage = value;
            await this.plugin.saveSettings();
            // Refresh voice options when language changes
            updateVoiceSettings();
          });
        });

      // Voice selection settings
      const updateVoiceSettings = () => {
        // Remove existing voice setting
        const voiceSetting = settingsContainer.querySelector("#voice-setting");
        if (voiceSetting) {
          voiceSetting.remove();
        }

        // Voice selection based on selected language
        // const voices = this.plugin.getAvailableVoices();
        const selectedLang = this.plugin.settings.defaultLanguage;
        const availableVoices = voices.filter((voice) => {
          return voice.lang === selectedLang; // || voice.lang.startsWith(selectedLang)
        });

        if (availableVoices.length > 0) {
          const voiceContainer = settingsContainer.createDiv({
            cls: "voice-setting",
            attr: { id: "voice-setting" },
          });
          new Setting(voiceContainer)
            .setName("Preferred Voice")
            .setDesc(`Choose a specific voice for ${selectedLang}`)
            .addDropdown((dropdown) => {
              dropdown.addOption("", "Auto (System Default)");
              availableVoices.forEach((voice) => {
                dropdown.addOption(voice.name, `${voice.name} (${voice.lang})`);
              });
              dropdown.setValue(this.plugin.settings.selectedVoice);
              dropdown.onChange(async (value) => {
                this.plugin.settings.selectedVoice = value;
                await this.plugin.saveSettings();
              });
            });
        }
      };

      updateVoiceSettings();

      // Test button settings
      new Setting(testContainer)
        .setName("Test Voice")
        .setDesc("Test the selected voice settings")
        .addButton((button) => {
          button.setButtonText("Test Speech");
          button.onClick(() => {
            const testText =
              "Hello, this is a test of the text-to-speech functionality.";
            this.plugin.speakText(
              testText,
              this.plugin.settings.defaultLanguage,
              this.plugin.settings.selectedVoice
            );
          });
        });
    };

    // Initial load
    if (window.speechSynthesis.getVoices().length === 0) {
      // Voices not loaded yet, wait for them
      window.speechSynthesis.onvoiceschanged = updateSettings;
      containerEl.createEl("p", {
        text: "Loading available voices...",
        attr: { id: "loading-msg" },
      });
    } else {
      updateSettings();
    }
  }
}
