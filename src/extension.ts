import * as vscode from 'vscode';
import { execSync } from 'child_process';
import axios from 'axios';

type BitriseClientEnvParams = {
  apiToken: string;
  appSlug: string;
};

const getBitriseClientEnvParams = (): BitriseClientEnvParams | undefined => {
  const config = vscode.workspace.getConfiguration('bitrise-client');
  const apiToken = config.get<string>('apiToken');
  const appSlug = config.get<string>('defaultAppSlug');

  if (!apiToken || !appSlug) {
    return undefined;
  }

  return {
    apiToken,
    appSlug,
  };
};

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    'bitrise-client.build',
    async () => {
      const params = getBitriseClientEnvParams();
      if (!params) {
        vscode.window.showErrorMessage(
          'Please set apiToken and defaultAppSlug in settings.'
        );
        return;
      }

      const { apiToken, appSlug: defaultAppSlug } = params;

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
          'Unable to determine current Git branch.'
        );
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      const currentBranchName = getCurrentBranchName(workspaceRoot);
      if (!currentBranchName) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
      }

      try {
        const workflows = await fetchBitriseWorkflows(defaultAppSlug, apiToken);
        const selectedWorkflow = await promptForWorkflow(workflows);

        if (!selectedWorkflow) {
          vscode.window.showErrorMessage('No workflow selected.');
          return;
        }

        // 現在のブランチ名を用いてビルドプロセスを開始
        startBitriseBuild({
          branchName: currentBranchName,
          apiToken: apiToken,
          appSlug: defaultAppSlug,
          workflowId: selectedWorkflow,
        });
      } catch (error) {
        vscode.window.showErrorMessage('Failed to fetch workflows.');
        console.error('Error:', error);
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}

const promptForWorkflow = async (
  workflows: string[]
): Promise<string | undefined> => {
  const selectedWorkflow = await vscode.window.showQuickPick(workflows, {
    placeHolder: 'Select a workflow',
  });

  return selectedWorkflow;
};

const getCurrentBranchName = (workspaceRoot: string): string | null => {
  try {
    // Git リポジトリ内で現在のブランチ名を取得
    const branchName = execSync('git branch --show-current', {
      cwd: workspaceRoot,
    })
      .toString()
      .trim();

    return branchName;
  } catch (error) {
    console.error('Error getting current branch name:', error);
    return null;
  }
};

const fetchBitriseWorkflows = async (
  appSlug: string,
  apiToken: string
): Promise<string[]> => {
  const url = `https://api.bitrise.io/v0.1/apps/${appSlug}/build-workflows`;

  type BitriseWorkflow = {
    data: string[];
  };

  try {
    const response = await axios.get<BitriseWorkflow>(url, {
      headers: {
        Authorization: `${apiToken}`,
      },
    });

    const workflows = response.data.data.map((workflow: string) => workflow);
    return workflows;
  } catch (error) {
    console.error('Error fetching Bitrise workflows:', error);
    throw new Error('Failed to fetch Bitrise workflows');
  }
};

export const startBitriseBuild = async ({
  branchName,
  apiToken,
  appSlug,
  workflowId,
}: {
  branchName: string;
  apiToken: string;
  appSlug: string;
  workflowId: string;
}) => {
  const url = `https://api.bitrise.io/v0.1/apps/${appSlug}/builds`;

  const requestBody = {
    build_params: {
      branch: branchName,
      workflow_id: workflowId,
    },
    hook_info: {
      type: 'bitrise',
    },
  };

  try {
    await axios.post(url, requestBody, {
      headers: {
        accept: 'application/json',
        Authorization: `${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    vscode.window.showInformationMessage('Build started successfully!');
  } catch (error) {
    vscode.window.showErrorMessage('Failed to start build.');
    console.error('Failed to start build:', error);
  }
};
