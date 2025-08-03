import {
  App,
  Plugin,
  Notice,
  Editor,
  MarkdownView,
  PluginSettingTab,
  Setting,
  TextComponent,
} from "obsidian";

interface ChattySettings {
  defaultLanguage: SpeechSynthesisVoice["lang"];
  selectedVoice: SpeechSynthesisVoice["name"];
  chattyDictateSelectionHotkey?: string; // Optional hotkey for dictating selected text
}

const DEFAULT_SETTINGS: ChattySettings = {
  defaultLanguage: navigator.language || "",
  selectedVoice:
    window.speechSynthesis.getVoices().find((voice) => voice.default)?.name ||
    "",
};

export default class ChattyPlugin extends Plugin {
  settings: ChattySettings;
  private dictateSelectionHotkeyHanlder: (event: KeyboardEvent) => void;

  constructor(app: App, manifest: any) {
    super(app, manifest);
    this.dictateSelectionHotkeyHanlder = (event: KeyboardEvent) => {
      const hotkey = this.settings.chattyDictateSelectionHotkey;
      if (!hotkey) return;
      let keyCombo = [];
      if (event.ctrlKey) keyCombo.push("Ctrl");
      if (event.shiftKey) keyCombo.push("Shift");
      if (event.altKey) keyCombo.push("Alt");
      if (event.metaKey) keyCombo.push("Meta");
      // Uppercase because setting is stored in uppercase
      keyCombo.push(
        event.key.length === 1 ? event.key.toUpperCase() : event.key
      );
      const pressedHotkey = keyCombo.join("+");

      if (pressedHotkey === hotkey) {
        event.preventDefault();
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
          const editor = activeView.editor;
          const selectedText = editor.getSelection();
          if (selectedText) {
            this.speakText(
              selectedText,
              this.settings.defaultLanguage,
              this.settings.selectedVoice
            );
          } else {
            new Notice("No text selected to dictate.");
          }
        }
      }
    };
  }

  async onload() {
    await this.loadSettings();
    new Notice(
      `Chatty Plugin Loaded\nLanguage: ${this.settings.defaultLanguage}\nVoice: ${this.settings.selectedVoice}`
    );

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
              .setIcon("volume-2")
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

    // Register the hotkey handler for dictating selected text
    window.addEventListener("keydown", this.dictateSelectionHotkeyHanlder);
  }

  onunload() {
    // Cancel any ongoing speech synthesis
    window.speechSynthesis.cancel();
    // Remove the hotkey event listener
    if (this.dictateSelectionHotkeyHanlder) {
      window.removeEventListener("keydown", this.dictateSelectionHotkeyHanlder);
    }
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
    containerEl.createEl("h1", { text: "Chatty Settings" });

    // Creates/Updates the relevant settings UI and functionality
    const updateSettings = async () => {
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
      const keyBindingsContainer = mainContainer.createDiv({
        cls: "key-bindings-container",
        attr: { id: "key-bindings-container" },
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
      const updateVoiceSettings = async () => {
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

      // Key bindings settings
      let hotkeyText: TextComponent;
      new Setting(keyBindingsContainer)
        .setName("Hotkey | Dictate Selection")
        .setDesc("Set a hotkey to dictate the selected text")
        .addText((text) => {
          hotkeyText = text;
          text
            .setValue(
              this.plugin.settings.chattyDictateSelectionHotkey ||
                "Ctrl+Shift+S"
            )
            .setPlaceholder("Press a key combination")
            .setDisabled(true);
        })
        .addButton((button) => {
          button.setIcon("plus").setTooltip("Set/Update Hotkey");
          const keyDownHandler = (event: KeyboardEvent) => {
            // Ignore if ONLY a modifier key is pressed
            const isModifier =
              event.key === "Control" ||
              event.key === "Shift" ||
              event.key === "Alt" ||
              event.key === "Meta";
            if (isModifier) return;

            let combo = [];
            if (event.ctrlKey) combo.push("Ctrl");
            if (event.shiftKey) combo.push("Shift");
            if (event.altKey) combo.push("Alt");
            if (event.metaKey) combo.push("Meta");
            // Single letter keys will be converted to uppercase
            combo.push(
              event.key.length === 1 ? event.key.toUpperCase() : event.key
            );
            const hotkey = combo.join("+");
            this.plugin.settings.chattyDictateSelectionHotkey = hotkey;
            this.plugin.saveSettings();
            hotkeyText.setValue(hotkey);
            new Notice(`Hotkey set to: ${hotkey}`);
            window.removeEventListener("keydown", keyDownHandler, true);
          };
          button.onClick(() => {
            new Notice("Press Hotkey ...");
            window.addEventListener("keydown", keyDownHandler, true);
          });
        })
        .addButton((button) => {
          button.setIcon("reset").setTooltip("Reset Hotkey to Default");
          button.onClick(async () => {
            this.plugin.settings.chattyDictateSelectionHotkey = "Ctrl+Shift+S"; // Reset to default
            await this.plugin.saveSettings();
            hotkeyText.setValue(
              this.plugin.settings.chattyDictateSelectionHotkey
            );
            new Notice("Hotkey reset to default.");
          });
        })
        .addButton((button) => {
          button.setIcon("trash").setTooltip("Clear Hotkey");
          button.onClick(async () => {
            this.plugin.settings.chattyDictateSelectionHotkey = "";
            await this.plugin.saveSettings();
            hotkeyText.setValue("");
            new Notice("Hotkey cleared.");
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
