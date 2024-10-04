import json
from django.http import JsonResponse
from django.views import View
from django.shortcuts import get_object_or_404, render, redirect
from .models import CustomUser
from main.models import Student
from django.contrib.auth import login
from .forms import CustomAuthenticationForm

class CustomLoginView(View):
    form_class = CustomAuthenticationForm
    template_name = 'login.html'

    def get(self, request, *args, **kwargs):
        form = self.form_class()
        return render(request, self.template_name, {'form': form})

    def post(self, request, *args, **kwargs):
        form = self.form_class(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            user = CustomUser.objects.get(username=username)
            if user.is_superuser:
                form.add_error(None, "Superusers are not allowed to log in.")
                return render(request, self.template_name, {'form': form})
            login(request, user)
            return redirect('main:profile')
        return render(request, self.template_name, {'form': form})

class StudentUpdateView(View):
    def post(self, request, *args, **kwargs):
        user_id = self.kwargs.get('user_id')
        user = get_object_or_404(CustomUser, pk=user_id)
        student = get_object_or_404(Student, user=user)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)

        username = data.get('username')
        password = data.get('password')
        student_number = data.get('student_number')

        if username:
            user.username = username
        if password:
            user.set_password(password)
        if student_number:
            student.student_number = student_number

        if CustomUser.objects.filter(username=username).exists():
            return JsonResponse({'error': 'このユーザネームはすでに使われている'}, status=400)

        if len(username) > 10:
            return JsonResponse({'error': 'ユーザーネームは最大１０文字'}, status=400)

        user.save()
        student.save()

        return JsonResponse({
            'message': 'Student info updated successfully',
            'username': user.username,
        })