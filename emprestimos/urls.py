from django.urls import path
from . import views 

urlpatterns = [
    path('', views.emprestimo, name='emprestimo_emprestimos')
]