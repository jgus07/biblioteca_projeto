from django.urls import path
from . import views 

urlpatterns = [
    path('', views.add, name='add_livros'),
    path('novo/', views.consultar, name='consultar_livros')
]