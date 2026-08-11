import { HttpError } from "../../shared/api/HttpClient";

export type NavigationFailureKind = "AUTHENTICATION" | "AUTHORIZATION" | "UNAVAILABLE";

/**
 * Keeps transport concerns at the application seam. Product navigation can
 * then render an actionable state without coupling the shell to fetch details.
 */
export function classifyNavigationFailure(failure: unknown): NavigationFailureKind {
  if (failure instanceof HttpError) {
    if (failure.status === 401) return "AUTHENTICATION";
    if (failure.status === 403) return "AUTHORIZATION";
  }
  return "UNAVAILABLE";
}

export function navigationFailureMessage(kind: NavigationFailureKind): string {
  switch (kind) {
    case "AUTHENTICATION":
      return "业务平台需要登录授权，请完成统一身份认证后重试。";
    case "AUTHORIZATION":
      return "当前账户没有访问业务导航的权限，请联系管理员。";
    case "UNAVAILABLE":
      return "产品导航加载失败，请稍后重试。";
  }
}
