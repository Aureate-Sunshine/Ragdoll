import * as vscode from "vscode";
// import * as _ from "lodash";
import { getConfiguration } from "../shared";
import { APIGroup } from "../types/types";
import { instance } from "../service";
import { transformYapi } from "../utils/dataTransform";
import { YapiView } from "../treeview/yapiViewTreeView";

export async function syncFromYapi(
  context: vscode.ExtensionContext
): Promise<any> {
  // 读取配置文件
  const isLdapLogin = getConfiguration<boolean>(
    "ragdoll-yapi.yapi",
    "ldapLogin"
  );
  const email = getConfiguration<string>("ragdoll-yapi.yapi", "email");
  const password = getConfiguration<string>("ragdoll-yapi.yapi", "password");
  let url = getConfiguration<string>("ragdoll-yapi.yapi", "url")?.trim();
  url = url?.match(/\/$/) ? url : url + "/";
  const pid = getConfiguration<string>("ragdoll-yapi.yapi", "pid")?.trim();

  if (!(email && password && url && pid)) {
    console.error("APIViewer: Missing some configurations!");
    return [];
  }

  vscode.window.showInformationMessage("APIViewer: Syncing data from Yapi");
  const apiGroups = await getYapiData(isLdapLogin, url, email, password, pid);

  const provider = new YapiView(context, apiGroups);
  vscode.window.createTreeView("yapiView", {
    treeDataProvider: provider,
  });

  vscode.window.showInformationMessage(`APIViewer: Sync from yapi successful`);
  //return await getYapiData(url, email, password, pid);
  await context.globalState.update("apiGroups", apiGroups);
}

export async function getYapiData(
  isLdapLogin: boolean,
  url: string,
  email: string,
  password: string,
  pid: string
) {
  let groups: APIGroup[] = [];
  // 登录获取cookie

  let response = null;

  if (isLdapLogin) {
    response = await instance.post(`${url}api/user/login_by_ldap`, {
      email,
      password,
    });
  } else {
    response = await instance.post(`${url}api/user/login`, { email, password });
  }

  const responseJson = JSON.parse(response.body);
  if (responseJson.errcode === 405) {
    console.error("APIViewer: Incorrect account or password");
    return [];
  }

  const apiResponse = await instance.get(
    `/api/plugin/export?type=json&pid=${pid}&status=all&isWiki=false`
  );

  try {
    // const data = JSON.parse(apiResponse[0]);
    groups = transformYapi(apiResponse);
  } catch (e) {
    console.error("APIViewer: Invalid data format");
    return [];
  }

  return groups;
}