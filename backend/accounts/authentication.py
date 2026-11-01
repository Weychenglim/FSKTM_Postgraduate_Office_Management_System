from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError

from .session_tokens import (
    CookieRefreshToken,
    is_blacklisted,
    refresh_cookie_name,
    rotation_grace_allows,
    signed_in_tab,
)


class RefreshCookieAuthentication(JWTAuthentication):
    """Authenticate refresh/logout requests from the scoped refresh cookie:
    the tab's own when it has one, else the browser's latest sign-in. The view
    finds which in request.refresh_tab."""

    def authenticate(self, request):
        tab = signed_in_tab(request)
        request.refresh_tab = tab
        raw_token = request.COOKIES.get(refresh_cookie_name(tab))
        if not raw_token:
            raise AuthenticationFailed("A valid refresh session is required.")

        try:
            refresh = CookieRefreshToken(raw_token)
            if is_blacklisted(refresh) and not rotation_grace_allows(request, refresh, tab):
                raise TokenError("Token is blacklisted")
            user = self.get_user(refresh)
        except TokenError as error:
            raise AuthenticationFailed("The refresh session is invalid or expired.") from error

        return user, refresh

    def authenticate_header(self, request):
        return 'Bearer realm="api"'
