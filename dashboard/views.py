from django.shortcuts import render

def add(request):
    return render(request, 'dashboard/index.html')
