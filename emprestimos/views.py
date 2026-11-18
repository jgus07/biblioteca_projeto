from django.shortcuts import render

def emprestimo(request):
    return render(request, 'emprestimos/emprestimo.html')
