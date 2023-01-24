import { ExecError } from '../utils';
import { WgStrategy } from './wgStrategy';

export class WgWindowsStrategy extends WgStrategy {
  async isInstalled(): Promise<boolean> {
    const wgCommand = 'wg --version';
    const wgQuickCommand = 'wg-quick --version';
    const { stderr } = await this.exec(wgCommand, false);
    if (stderr) {
      return false;
    }

    try {
      await this.exec(wgQuickCommand, false);
      return false;
    } catch (error) {
      if (error instanceof ExecError) {
        return !String(error.stderr).includes('command not found');
      }
      throw error;
    }
  }

  async getActiveDevice(): Promise<string | null> {
    try {
      const { stderr, stdout } = await this.exec('wg show', false);
      if (stderr) {
        throw new Error(stderr);
      }

      const lines = stdout!.split(/\n/);
      return lines[0].split(' ')[1]?.replace(/(\r\n|\n|\r)/gm, '') || null;
    } catch (error) {
      if (error instanceof ExecError && error.stderr) {
        const splittedText: string[] = String(error.stderr).split(':');

        if (splittedText.length === 0) {
          return '';
        }
        return splittedText[0].split(' ').slice(-1)[0];
      }
      throw error;
    }
  }

  async up(filePath: string): Promise<void> {
    await this.exec(`wireguard /installtunnelservice ${filePath}`);
  }

  async down(filePath: string): Promise<void> {
    await this.exec(
      `wireguard /uninstalltunnelservice ${this.getNameFromPath(filePath)}`,
    );
  }

  getNameFromPath(filePath: string): string {
    const filename = filePath.replace(/^.*[\\/]/, '');
    return filename.slice(0, Math.max(0, filename.lastIndexOf('.')));
  }

  async status(device: string): Promise<boolean> {
    try {
      const { stderr, stdout } = await this.exec(`wg show ${device}`);
      if (stderr) {
        throw new Error(String(stderr));
      }
      return Boolean(stdout!.match(/interface: (.*)/));
    } catch (error) {
      if (
        error instanceof ExecError &&
        error.stderr &&
        String(error.stderr).includes('No such device')
      ) {
        return false;
      }
      throw error;
    }
  }

  async generatePrivateKey(): Promise<string> {
    const { stdout, stderr } = await this.exec('wg genkey', false);
    if (stderr) {
      throw new Error(stderr);
    }
    return stdout!.trim();
  }

  async getPublicKey(privateKey: string): Promise<string> {
    const command = `echo ${privateKey} | wg pubkey`;
    const { stdout, stderr } = await this.exec(command, false);
    if (stderr) {
      throw new Error(stderr);
    }
    return stdout!.trim();
  }
}
