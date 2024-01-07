import * as vscode from 'vscode';
import { execSync } from 'child_process';
import {
  abortBitriseBuild,
  fetchBitriseNotFinishedBuildSlugs,
  fetchBitriseWorkflows,
  startBitriseBuild,
} from './bitrise';

export function activate(context: vscode.ExtensionContext) {
  const buildDisposable = vscode.commands.registerCommand(
    'bitrise-client.build',
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
          'Unable to determine current Git branch.'
        );
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const currentBranchName = getCurrentBranchName(workspaceRoot);
      if (currentBranchName === null) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
      }

      try {
        const workflows = await fetchBitriseWorkflows();
        const selectedWorkflow = await promptForWorkflow(workflows);
        if (!selectedWorkflow) {
          vscode.window.showErrorMessage('No workflow selected.');
          return;
        }

        // 現在のブランチ名を用いてビルドプロセスを開始
        await startBitriseBuild({
          branchName: currentBranchName,
          workflowId: selectedWorkflow,
        });
        vscode.window.showInformationMessage('Build started successfully!');
      } catch (error) {
        vscode.window.showErrorMessage('Failed to fetch workflows:' + error);
      }
    }
  );

  const abortBuildDisposable = vscode.commands.registerCommand(
    'bitrise-client.abortBuild',
    async () => {
      try {
        const notFinishedBuildSlugs = await fetchBitriseNotFinishedBuildSlugs();
        if (notFinishedBuildSlugs.length === 0) {
          vscode.window.showInformationMessage('No build to abort.');
          return;
        }

        const selectedBuildSlug = await promptForWorkflow(
          notFinishedBuildSlugs
        );
        if (!selectedBuildSlug) {
          vscode.window.showErrorMessage('No build selected.');
          return;
        }

        await abortBitriseBuild(selectedBuildSlug);
      } catch (error) {
        vscode.window.showErrorMessage('Failed to fetch workflows:' + error);
      }
    }
  );

  context.subscriptions.push(buildDisposable, abortBuildDisposable);
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
    return null;
  }
};
