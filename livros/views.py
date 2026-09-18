from django.shortcuts import render

def add(request):
    return render(request, 'livros/add.html')

def consultar(request):
    return render(request, 'livros/consultar.html')