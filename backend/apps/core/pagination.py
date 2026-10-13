"""Project pagination. DRF 3.18+ no longer reads PAGE_SIZE_QUERY_PARAM/MAX_PAGE_SIZE
from settings, so the knobs live on this class."""

from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100
