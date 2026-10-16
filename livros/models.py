from django.db import models

class Exemplar(models.Model):
    localização = models.CharField(max_length=50, unique=True)
    status = models.BooleanField(max_length=50, unique=True)

    def __str__(self):
        return self.localização
    
    def __str__(self):
        return self.status