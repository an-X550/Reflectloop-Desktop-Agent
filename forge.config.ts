import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // Koffi is used by DSH's Windows durable JSONL publisher and loads a
      // native .node binary; native modules cannot be dlopen'ed from asar.
      unpack: '**/*.node',
    },
    appBundleId: 'com.zhiji.desktop',
    // Keep the Windows executable name ASCII-safe for Squirrel's nupkg
    // archive. The UI/product name remains the Chinese "知己".
    executableName: 'zhiji',
    // The Vite plugin normally excludes every node_modules entry because
    // application dependencies are bundled. DSH must stay external so its
    // package-relative package.json lookup remains valid, therefore keep only
    // the DSH runtime and its Windows FFI dependency in the production asar.
    ignore: (file) => {
      if (!file) return false;
      const normalized = file.replace(/\\/g, '/').toLowerCase();
      const keptPaths = [
        '/.vite',
        '/node_modules/@deepseek-ai',
        '/node_modules/koffi',
        '/node_modules/@koromix',
      ];
      const kept =
        normalized === '/' ||
        normalized === '/resources' ||
        normalized.endsWith('/resources') ||
        normalized === '/resources/app' ||
        normalized.endsWith('/resources/app') ||
        normalized === '/node_modules' ||
        normalized.endsWith('/resources/app/node_modules') ||
        normalized.endsWith('/node_modules') ||
        normalized === '/package.json' ||
        normalized.endsWith('/resources/app/package.json') ||
        keptPaths.some(
          (path) =>
            normalized === path ||
            normalized.endsWith(path) ||
            normalized.includes(`${path}/`),
        );
      return !kept;
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({ name: 'zhiji', setupIcon: undefined }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/main-process/agent/utility.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
