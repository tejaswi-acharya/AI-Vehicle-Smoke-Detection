class PlateReader:
    def __init__(self):
        from ai.anpr.model_loader import check_model_files, load_models

        try:
            check_model_files()
        except FileNotFoundError as error:
            print(f"[plate] Recognition disabled: {error}")
            self.models = None
            return

        try:
            self.models = load_models()
        except ModuleNotFoundError as error:
            print(f"[plate] Recognition disabled: missing dependency {error.name}")
            self.models = None

    def read(self, vehicle_image):
        if self.models is None:
            return None

        from ai.anpr.anpr import detect_plate_and_read

        return detect_plate_and_read(vehicle_image, self.models)